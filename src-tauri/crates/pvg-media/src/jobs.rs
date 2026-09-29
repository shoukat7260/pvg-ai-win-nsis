//! Cooperative media job queue with bounded concurrency.

use crate::error::{MediaError, MediaResult};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JobType {
    Import,
    Probe,
    Thumbnail,
    Waveform,
    Proxy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JobState {
    Queued,
    Running,
    Completed,
    Failed,
    CancelRequested,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum JobStage {
    Queued,
    Starting,
    Probing,
    Processing,
    Writing,
    Finalizing,
    Done,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobProgress {
    pub stage: JobStage,
    /// 0.0 ..= 1.0
    pub fraction: f32,
    pub message: Option<String>,
}

impl Default for JobProgress {
    fn default() -> Self {
        Self {
            stage: JobStage::Queued,
            fraction: 0.0,
            message: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobSnapshot {
    pub id: String,
    pub job_type: JobType,
    pub state: JobState,
    pub progress: JobProgress,
    pub error: Option<String>,
    pub asset_id: Option<String>,
}

struct JobInner {
    id: String,
    job_type: JobType,
    state: JobState,
    progress: JobProgress,
    error: Option<String>,
    asset_id: Option<String>,
    cancel: Arc<AtomicBool>,
}

/// Work unit submitted to the manager. Callers supply the closure so Tauri
/// integration can wire probe/thumbnail/etc. without this crate depending on IPC.
pub struct JobWork {
    pub job_type: JobType,
    pub asset_id: Option<String>,
    pub run: Box<dyn FnOnce(&JobHandle) -> MediaResult<()> + Send>,
}

/// Handle visible to running work for progress + cooperative cancel checks.
#[derive(Clone)]
pub struct JobHandle {
    id: String,
    cancel: Arc<AtomicBool>,
    manager: Arc<Mutex<JobManagerInner>>,
}

impl JobHandle {
    pub fn id(&self) -> &str {
        &self.id
    }

    pub fn is_cancel_requested(&self) -> bool {
        self.cancel.load(Ordering::SeqCst)
    }

    /// Returns `Err(JobCancelled)` when cancel was requested.
    pub fn check_cancel(&self) -> MediaResult<()> {
        if self.is_cancel_requested() {
            Err(MediaError::JobCancelled)
        } else {
            Ok(())
        }
    }

    pub fn set_progress(&self, stage: JobStage, fraction: f32, message: Option<String>) {
        let mut guard = self.manager.lock();
        if let Some(job) = guard.jobs.get_mut(&self.id) {
            if matches!(
                job.state,
                JobState::Cancelled | JobState::Completed | JobState::Failed
            ) {
                return;
            }
            job.progress = JobProgress {
                stage,
                fraction: fraction.clamp(0.0, 1.0),
                message,
            };
        }
    }
}

struct JobManagerInner {
    jobs: HashMap<String, JobInner>,
    queue: Vec<String>,
    running: usize,
    max_concurrency: usize,
}

/// Bounded job pool with cooperative cancellation.
pub struct JobManager {
    inner: Arc<Mutex<JobManagerInner>>,
}

impl Default for JobManager {
    fn default() -> Self {
        Self::new(2)
    }
}

impl JobManager {
    pub fn new(max_concurrency: usize) -> Self {
        Self {
            inner: Arc::new(Mutex::new(JobManagerInner {
                jobs: HashMap::new(),
                queue: Vec::new(),
                running: 0,
                max_concurrency: max_concurrency.max(1),
            })),
        }
    }

    pub fn max_concurrency(&self) -> usize {
        self.inner.lock().max_concurrency
    }

    pub fn submit(&self, work: JobWork) -> String {
        let id = Uuid::new_v4().to_string();
        let cancel = Arc::new(AtomicBool::new(false));
        let job = JobInner {
            id: id.clone(),
            job_type: work.job_type,
            state: JobState::Queued,
            progress: JobProgress::default(),
            error: None,
            asset_id: work.asset_id,
            cancel: cancel.clone(),
        };

        {
            let mut guard = self.inner.lock();
            guard.jobs.insert(id.clone(), job);
            guard.queue.push(id.clone());
        }

        let manager = self.inner.clone();
        let run = work.run;
        let id_for_worker = id.clone();
        thread::spawn(move || {
            wait_for_slot_and_run(manager, id_for_worker, cancel, run);
        });

        id
    }

    /// Request cooperative cancellation. Transitions Queued/Running → CancelRequested,
    /// or Queued directly to Cancelled if not yet started.
    pub fn request_cancel(&self, job_id: &str) -> MediaResult<JobSnapshot> {
        let mut guard = self.inner.lock();
        let job = guard
            .jobs
            .get_mut(job_id)
            .ok_or_else(|| MediaError::InvalidInput(format!("unknown job: {job_id}")))?;

        match job.state {
            JobState::Completed | JobState::Failed | JobState::Cancelled => {}
            JobState::Queued => {
                job.cancel.store(true, Ordering::SeqCst);
                // Remove from queue if still waiting.
                guard.queue.retain(|id| id != job_id);
                // Re-borrow after retain
                let job = guard.jobs.get_mut(job_id).unwrap();
                job.state = JobState::Cancelled;
                job.progress = JobProgress {
                    stage: JobStage::Cancelled,
                    fraction: job.progress.fraction,
                    message: Some("cancelled before start".into()),
                };
            }
            JobState::Running | JobState::CancelRequested => {
                job.cancel.store(true, Ordering::SeqCst);
                job.state = JobState::CancelRequested;
                job.progress.message = Some("cancel requested".into());
            }
        }

        Ok(snapshot(guard.jobs.get(job_id).unwrap()))
    }

    pub fn get(&self, job_id: &str) -> Option<JobSnapshot> {
        self.inner.lock().jobs.get(job_id).map(snapshot)
    }

    pub fn list(&self) -> Vec<JobSnapshot> {
        self.inner.lock().jobs.values().map(snapshot).collect()
    }
}

fn snapshot(job: &JobInner) -> JobSnapshot {
    JobSnapshot {
        id: job.id.clone(),
        job_type: job.job_type,
        state: job.state,
        progress: job.progress.clone(),
        error: job.error.clone(),
        asset_id: job.asset_id.clone(),
    }
}

fn wait_for_slot_and_run(
    manager: Arc<Mutex<JobManagerInner>>,
    id: String,
    cancel: Arc<AtomicBool>,
    run: Box<dyn FnOnce(&JobHandle) -> MediaResult<()> + Send>,
) {
    // Wait until we can claim a running slot, or we're cancelled while queued.
    loop {
        {
            let mut guard = manager.lock();
            let Some(job) = guard.jobs.get(&id) else {
                return;
            };
            if job.state == JobState::Cancelled || cancel.load(Ordering::SeqCst) {
                if let Some(job) = guard.jobs.get_mut(&id) {
                    job.state = JobState::Cancelled;
                    job.progress.stage = JobStage::Cancelled;
                }
                return;
            }
            // Must still be in queue to start.
            let in_queue = guard.queue.iter().any(|q| q == &id);
            if !in_queue {
                // Cancelled and removed from queue.
                return;
            }
            if guard.running < guard.max_concurrency {
                guard.queue.retain(|q| q != &id);
                guard.running += 1;
                if let Some(job) = guard.jobs.get_mut(&id) {
                    job.state = JobState::Running;
                    job.progress = JobProgress {
                        stage: JobStage::Starting,
                        fraction: 0.0,
                        message: None,
                    };
                }
                break;
            }
        }
        thread::sleep(Duration::from_millis(5));
    }

    let handle = JobHandle {
        id: id.clone(),
        cancel: cancel.clone(),
        manager: manager.clone(),
    };

    let result = if cancel.load(Ordering::SeqCst) {
        Err(MediaError::JobCancelled)
    } else {
        run(&handle)
    };

    let mut guard = manager.lock();
    if guard.running > 0 {
        guard.running -= 1;
    }
    if let Some(job) = guard.jobs.get_mut(&id) {
        match result {
            Ok(()) => {
                if cancel.load(Ordering::SeqCst)
                    || matches!(job.state, JobState::CancelRequested)
                {
                    job.state = JobState::Cancelled;
                    job.progress.stage = JobStage::Cancelled;
                } else {
                    job.state = JobState::Completed;
                    job.progress = JobProgress {
                        stage: JobStage::Done,
                        fraction: 1.0,
                        message: None,
                    };
                }
            }
            Err(MediaError::JobCancelled) => {
                job.state = JobState::Cancelled;
                job.progress.stage = JobStage::Cancelled;
                job.error = Some("cancelled".into());
            }
            Err(err) => {
                job.state = JobState::Failed;
                job.progress.stage = JobStage::Failed;
                job.error = Some(err.to_string());
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::mpsc;

    #[test]
    fn cancel_queued_job_transitions_to_cancelled() {
        let mgr = JobManager::new(1);
        // Occupy the single slot with a long-running job.
        let (started_tx, started_rx) = mpsc::channel();
        let (release_tx, release_rx) = mpsc::channel::<()>();

        let _blocker = mgr.submit(JobWork {
            job_type: JobType::Import,
            asset_id: None,
            run: Box::new(move |h| {
                started_tx.send(()).ok();
                let _ = release_rx.recv();
                h.check_cancel()?;
                Ok(())
            }),
        });
        started_rx.recv_timeout(Duration::from_secs(2)).unwrap();

        let queued_id = mgr.submit(JobWork {
            job_type: JobType::Probe,
            asset_id: Some("a1".into()),
            run: Box::new(|_h| {
                thread::sleep(Duration::from_secs(30));
                Ok(())
            }),
        });

        // Give the worker a moment to park in the wait loop.
        thread::sleep(Duration::from_millis(20));
        let snap = mgr.request_cancel(&queued_id).unwrap();
        assert_eq!(snap.state, JobState::Cancelled);

        release_tx.send(()).ok();
        // Wait for blocker to finish.
        for _ in 0..50 {
            if let Some(s) = mgr.get(&_blocker) {
                if matches!(s.state, JobState::Completed | JobState::Failed | JobState::Cancelled) {
                    break;
                }
            }
            thread::sleep(Duration::from_millis(10));
        }
    }

    #[test]
    fn cancel_running_job_cooperative() {
        let mgr = JobManager::new(2);
        let (started_tx, started_rx) = mpsc::channel();

        let id = mgr.submit(JobWork {
            job_type: JobType::Thumbnail,
            asset_id: None,
            run: Box::new(move |h| {
                started_tx.send(()).ok();
                h.set_progress(JobStage::Processing, 0.2, None);
                loop {
                    h.check_cancel()?;
                    thread::sleep(Duration::from_millis(5));
                }
            }),
        });

        started_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        let snap = mgr.request_cancel(&id).unwrap();
        assert!(matches!(
            snap.state,
            JobState::CancelRequested | JobState::Cancelled
        ));

        for _ in 0..100 {
            if let Some(s) = mgr.get(&id) {
                if s.state == JobState::Cancelled {
                    return;
                }
            }
            thread::sleep(Duration::from_millis(10));
        }
        panic!("job did not reach Cancelled: {:?}", mgr.get(&id));
    }
}
