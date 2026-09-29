//! Phase 3 media IPC — probe, import, derivatives, jobs, storage summary.
//!
//! Import source files may live **outside** the workspace (LINK). Project paths
//! and derivative outputs are always constrained under AppState roots / the
//! project bundle via `pvg-media::path_safe`.

use crate::errors::{to_invoke_error, AppError, AppResult};
use crate::filesystem::validate_path_under_roots;
use crate::state::AppState;
use chrono::Utc;
use pvg_core::{load_project, save_project, DerivativeRef, ProjectAsset, ProjectDocument};
use pvg_media::{
    export_sequence_mp4, generate_proxy, generate_thumbnail, generate_waveform, import_asset,
    locate_ffmpeg, locate_ffprobe, probe_media, relink_asset, remove_asset, resolve_asset_source,
    validate_import_source, ExportResult, ImportMode, JobSnapshot, JobStage, JobType, JobWork,
    MediaError, ProbeResult, ScaleProfile, ThumbnailOptions, PROXIES_DIR, THUMBNAILS_DIR,
    WAVEFORMS_DIR,
};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::State;
use uuid::Uuid;

const ENGINE_VERSION: &str = env!("CARGO_PKG_VERSION");

fn media_err(err: MediaError) -> AppError {
    match err {
        MediaError::PathRejected(m) => AppError::PathRejected(m),
        MediaError::InvalidInput(m) => AppError::InvalidInput(m),
        MediaError::Io(m) => AppError::Io(m),
        MediaError::EngineUnavailable(m) => AppError::Internal(format!("media engine: {m}")),
        other => AppError::Internal(other.to_string()),
    }
}

fn validate_project_bundle(state: &AppState, project_path: &str) -> AppResult<PathBuf> {
    if project_path.trim().is_empty() {
        return Err(AppError::InvalidInput("projectPath is required".into()));
    }
    let path = PathBuf::from(project_path.trim());
    validate_path_under_roots(&path, &state.path_policy())
}

fn parse_scale_profile(profile: Option<&str>) -> AppResult<ScaleProfile> {
    match profile.map(|s| s.trim().to_ascii_lowercase()).as_deref() {
        None | Some("") | Some("quarter") => Ok(ScaleProfile::Quarter),
        Some("half") => Ok(ScaleProfile::Half),
        Some("eighth") => Ok(ScaleProfile::Eighth),
        Some(other) => Err(AppError::InvalidInput(format!(
            "unknown proxy profile: {other}"
        ))),
    }
}

fn probe_to_metadata(
    probe: &ProbeResult,
) -> (
    Option<pvg_core::VideoMetadata>,
    Option<pvg_core::AudioMetadata>,
    Option<pvg_core::ImageMetadata>,
) {
    let duration_ms = probe.duration_secs.map(|s| s * 1000.0);
    if probe.is_image {
        return (
            None,
            None,
            Some(pvg_core::ImageMetadata {
                width: probe.width,
                height: probe.height,
                format: probe.container.clone(),
                orientation: None,
                has_alpha: false,
            }),
        );
    }
    let video = if probe.has_video {
        Some(pvg_core::VideoMetadata {
            width: probe.width,
            height: probe.height,
            duration_ms,
            frame_rate: probe.fps,
            codec: probe.video_codec.clone(),
            container: probe.container.clone(),
            pixel_format: None,
            bitrate: None,
            rotation: None,
            has_audio: probe.has_audio,
        })
    } else {
        None
    };
    let audio = if probe.has_audio {
        Some(pvg_core::AudioMetadata {
            duration_ms,
            sample_rate: None,
            channels: None,
            codec: probe.audio_codec.clone(),
            bitrate: None,
            bit_depth: None,
        })
    } else {
        None
    };
    (video, audio, None)
}

fn guess_kind_from_probe(probe: &ProbeResult) -> String {
    if probe.is_image {
        "image".into()
    } else if probe.has_video {
        "video".into()
    } else if probe.has_audio {
        "audio".into()
    } else {
        "other".into()
    }
}

fn update_asset_in_project(
    project_path: &Path,
    asset_id: Uuid,
    mutator: impl FnOnce(&mut pvg_core::ProjectAsset),
) -> AppResult<()> {
    let mut doc = load_project(project_path)?;
    let asset = doc
        .find_asset_mut(&asset_id)
        .ok_or_else(|| AppError::NotFound(format!("asset not found: {asset_id}")))?;
    mutator(asset);
    asset.updated_at = Utc::now();
    save_project(project_path, &doc)?;
    Ok(())
}

fn queue_post_import_jobs(state: &AppState, project_path: PathBuf, asset_id: Uuid) {
    let jobs = state.jobs.clone();
    let asset_id_str = asset_id.to_string();

    {
        let project_path = project_path.clone();
        let aid = asset_id;
        jobs.submit(JobWork {
            job_type: JobType::Probe,
            asset_id: Some(asset_id_str.clone()),
            run: Box::new(move |handle| {
                handle.set_progress(JobStage::Probing, 0.1, Some("probing".into()));
                handle.check_cancel()?;
                let doc = load_project(&project_path)
                    .map_err(|e| MediaError::JobFailed(e.to_string()))?;
                let asset = doc
                    .find_asset(&aid)
                    .ok_or_else(|| MediaError::InvalidInput(format!("asset missing: {aid}")))?;
                let source = resolve_asset_source(&project_path, asset)?;
                let probe = probe_media(&source)?;
                handle.check_cancel()?;
                handle.set_progress(JobStage::Writing, 0.8, None);
                let (video, audio, image) = probe_to_metadata(&probe);
                let kind = guess_kind_from_probe(&probe);
                update_asset_in_project(&project_path, aid, |a| {
                    a.kind = kind;
                    a.video = video;
                    a.audio = audio;
                    a.image = image;
                })
                .map_err(|e| MediaError::JobFailed(e.to_string()))?;
                handle.set_progress(JobStage::Done, 1.0, None);
                Ok(())
            }),
        });
    }

    {
        let project_path = project_path.clone();
        let aid = asset_id;
        jobs.submit(JobWork {
            job_type: JobType::Thumbnail,
            asset_id: Some(asset_id_str.clone()),
            run: Box::new(move |handle| {
                handle.set_progress(JobStage::Starting, 0.05, None);
                handle.check_cancel()?;
                let doc = load_project(&project_path)
                    .map_err(|e| MediaError::JobFailed(e.to_string()))?;
                let asset = doc
                    .find_asset(&aid)
                    .ok_or_else(|| MediaError::InvalidInput(format!("asset missing: {aid}")))?;
                let source = resolve_asset_source(&project_path, asset)?;
                handle.set_progress(JobStage::Processing, 0.3, Some("thumbnail".into()));
                let out = generate_thumbnail(
                    &project_path,
                    &source,
                    &aid.to_string(),
                    &ThumbnailOptions::default(),
                )?;
                handle.check_cancel()?;
                let rel = format!("{THUMBNAILS_DIR}/{aid}.jpg");
                let byte_size = fs::metadata(&out).ok().map(|m| m.len());
                update_asset_in_project(&project_path, aid, |a| {
                    a.thumbnail = Some(DerivativeRef {
                        relative_path: rel,
                        engine_version: ENGINE_VERSION.into(),
                        created_at: Utc::now(),
                        byte_size,
                    });
                })
                .map_err(|e| MediaError::JobFailed(e.to_string()))?;
                Ok(())
            }),
        });
    }

    {
        let project_path = project_path.clone();
        let aid = asset_id;
        jobs.submit(JobWork {
            job_type: JobType::Waveform,
            asset_id: Some(asset_id_str),
            run: Box::new(move |handle| {
                handle.set_progress(JobStage::Starting, 0.05, None);
                handle.check_cancel()?;
                let doc = load_project(&project_path)
                    .map_err(|e| MediaError::JobFailed(e.to_string()))?;
                let asset = doc
                    .find_asset(&aid)
                    .ok_or_else(|| MediaError::InvalidInput(format!("asset missing: {aid}")))?;
                let source = resolve_asset_source(&project_path, asset)?;
                handle.set_progress(JobStage::Processing, 0.3, Some("waveform".into()));
                let (out, _) = generate_waveform(&project_path, &source, &aid.to_string(), 0)?;
                handle.check_cancel()?;
                let rel = format!("{WAVEFORMS_DIR}/{aid}.json");
                let byte_size = fs::metadata(&out).ok().map(|m| m.len());
                update_asset_in_project(&project_path, aid, |a| {
                    a.waveform = Some(DerivativeRef {
                        relative_path: rel,
                        engine_version: ENGINE_VERSION.into(),
                        created_at: Utc::now(),
                        byte_size,
                    });
                })
                .map_err(|e| MediaError::JobFailed(e.to_string()))?;
                Ok(())
            }),
        });
    }
}

// --- IPC types ---

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProbeInput {
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaImportInput {
    pub project_path: String,
    pub source_path: String,
    /// `"link"` | `"copy"`
    pub mode: String,
    pub name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaImportResult {
    pub asset: ProjectAsset,
    pub job_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaProjectInput {
    pub project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaRemoveInput {
    pub project_path: String,
    pub asset_id: String,
    #[serde(default)]
    pub delete_managed_copy: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaRelinkInput {
    pub project_path: String,
    pub asset_id: String,
    pub new_source_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaDerivativeInput {
    pub project_path: String,
    pub asset_id: String,
    pub profile: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaCancelJobInput {
    pub job_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StorageSummary {
    pub project_path: String,
    pub total_bytes: u64,
    pub media_bytes: u64,
    pub proxies_bytes: u64,
    pub thumbnails_bytes: u64,
    pub waveforms_bytes: u64,
    pub cache_bytes: u64,
    pub other_bytes: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaEngineStatus {
    pub ffmpeg_available: bool,
    pub ffprobe_available: bool,
    pub ffmpeg_path: Option<String>,
    pub ffprobe_path: Option<String>,
    pub ffmpeg_version: Option<String>,
    pub ffprobe_version: Option<String>,
}

fn dir_size(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    let mut total = 0u64;
    for p in walkdir_files(path) {
        if let Ok(meta) = fs::metadata(&p) {
            if meta.is_file() {
                total = total.saturating_add(meta.len());
            }
        }
    }
    total
}

fn walkdir_files(root: &Path) -> Vec<PathBuf> {
    let mut out = Vec::new();
    let mut stack = vec![root.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(entries) = fs::read_dir(&dir) else {
            continue;
        };
        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                stack.push(path);
            } else {
                out.push(path);
            }
        }
    }
    out
}

fn tool_version(binary: &Path) -> Option<String> {
    let output = Command::new(binary).arg("-version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    text.lines().next().map(|l| l.trim().to_string())
}

#[tauri::command]
pub fn media_probe(
    _state: State<'_, AppState>,
    input: MediaProbeInput,
) -> Result<ProbeResult, String> {
    media_probe_inner(input).map_err(to_invoke_error)
}

fn media_probe_inner(input: MediaProbeInput) -> AppResult<ProbeResult> {
    let path = PathBuf::from(input.path.trim());
    let validated = validate_import_source(&path).map_err(media_err)?;
    probe_media(&validated).map_err(media_err)
}

#[tauri::command]
pub fn media_import(
    state: State<'_, AppState>,
    input: MediaImportInput,
) -> Result<MediaImportResult, String> {
    media_import_inner(&state, input).map_err(to_invoke_error)
}

fn media_import_inner(state: &AppState, input: MediaImportInput) -> AppResult<MediaImportResult> {
    let project = validate_project_bundle(state, &input.project_path)?;
    let mode = ImportMode::parse(&input.mode).map_err(media_err)?;
    let asset = import_asset(
        &project,
        Path::new(input.source_path.trim()),
        mode,
        input.name.as_deref(),
    )
    .map_err(media_err)?;

    let before: std::collections::HashSet<String> =
        state.jobs.list().into_iter().map(|j| j.id).collect();
    queue_post_import_jobs(state, project, asset.id);
    let job_ids: Vec<String> = state
        .jobs
        .list()
        .into_iter()
        .map(|j| j.id)
        .filter(|id| !before.contains(id))
        .collect();

    Ok(MediaImportResult { asset, job_ids })
}

#[tauri::command]
pub fn media_list_assets(
    state: State<'_, AppState>,
    input: MediaProjectInput,
) -> Result<Vec<ProjectAsset>, String> {
    media_list_assets_inner(&state, input).map_err(to_invoke_error)
}

fn media_list_assets_inner(
    state: &AppState,
    input: MediaProjectInput,
) -> AppResult<Vec<ProjectAsset>> {
    let project = validate_project_bundle(state, &input.project_path)?;
    let doc = load_project(&project)?;
    Ok(doc.assets)
}

#[tauri::command]
pub fn media_remove_asset(
    state: State<'_, AppState>,
    input: MediaRemoveInput,
) -> Result<ProjectDocument, String> {
    media_remove_asset_inner(&state, input).map_err(to_invoke_error)
}

fn media_remove_asset_inner(
    state: &AppState,
    input: MediaRemoveInput,
) -> AppResult<ProjectDocument> {
    let project = validate_project_bundle(state, &input.project_path)?;
    let asset_id: Uuid = input
        .asset_id
        .trim()
        .parse()
        .map_err(|_| AppError::InvalidInput("assetId must be a uuid".into()))?;
    remove_asset(&project, asset_id, input.delete_managed_copy).map_err(media_err)
}

#[tauri::command]
pub fn media_relink_asset(
    state: State<'_, AppState>,
    input: MediaRelinkInput,
) -> Result<ProjectAsset, String> {
    media_relink_asset_inner(&state, input).map_err(to_invoke_error)
}

fn media_relink_asset_inner(
    state: &AppState,
    input: MediaRelinkInput,
) -> AppResult<ProjectAsset> {
    let project = validate_project_bundle(state, &input.project_path)?;
    let asset_id: Uuid = input
        .asset_id
        .trim()
        .parse()
        .map_err(|_| AppError::InvalidInput("assetId must be a uuid".into()))?;
    relink_asset(
        &project,
        asset_id,
        Path::new(input.new_source_path.trim()),
    )
    .map_err(media_err)
}

fn submit_derivative_job(
    state: &AppState,
    project: PathBuf,
    asset_id: Uuid,
    job_type: JobType,
    profile: Option<String>,
) -> String {
    let asset_id_str = asset_id.to_string();
    state.jobs.submit(JobWork {
        job_type,
        asset_id: Some(asset_id_str.clone()),
        run: Box::new(move |handle| {
            handle.set_progress(JobStage::Starting, 0.05, None);
            handle.check_cancel()?;
            let doc =
                load_project(&project).map_err(|e| MediaError::JobFailed(e.to_string()))?;
            let asset = doc
                .find_asset(&asset_id)
                .ok_or_else(|| MediaError::InvalidInput(format!("asset missing: {asset_id}")))?;
            let source = resolve_asset_source(&project, asset)?;
            handle.set_progress(JobStage::Processing, 0.3, None);
            match job_type {
                JobType::Thumbnail => {
                    let out = generate_thumbnail(
                        &project,
                        &source,
                        &asset_id_str,
                        &ThumbnailOptions::default(),
                    )?;
                    let rel = format!("{THUMBNAILS_DIR}/{asset_id_str}.jpg");
                    let byte_size = fs::metadata(&out).ok().map(|m| m.len());
                    update_asset_in_project(&project, asset_id, |a| {
                        a.thumbnail = Some(DerivativeRef {
                            relative_path: rel,
                            engine_version: ENGINE_VERSION.into(),
                            created_at: Utc::now(),
                            byte_size,
                        });
                    })
                    .map_err(|e| MediaError::JobFailed(e.to_string()))?;
                }
                JobType::Waveform => {
                    let (out, _) = generate_waveform(&project, &source, &asset_id_str, 0)?;
                    let rel = format!("{WAVEFORMS_DIR}/{asset_id_str}.json");
                    let byte_size = fs::metadata(&out).ok().map(|m| m.len());
                    update_asset_in_project(&project, asset_id, |a| {
                        a.waveform = Some(DerivativeRef {
                            relative_path: rel,
                            engine_version: ENGINE_VERSION.into(),
                            created_at: Utc::now(),
                            byte_size,
                        });
                    })
                    .map_err(|e| MediaError::JobFailed(e.to_string()))?;
                }
                JobType::Proxy => {
                    let scale = match profile.as_deref() {
                        Some("half") => ScaleProfile::Half,
                        Some("eighth") => ScaleProfile::Eighth,
                        _ => ScaleProfile::Quarter,
                    };
                    let out = generate_proxy(&project, &source, &asset_id_str, scale)?;
                    let rel = format!("{PROXIES_DIR}/{asset_id_str}_{}.mp4", scale.as_str());
                    let byte_size = fs::metadata(&out).ok().map(|m| m.len());
                    update_asset_in_project(&project, asset_id, |a| {
                        a.proxy = Some(DerivativeRef {
                            relative_path: rel,
                            engine_version: ENGINE_VERSION.into(),
                            created_at: Utc::now(),
                            byte_size,
                        });
                    })
                    .map_err(|e| MediaError::JobFailed(e.to_string()))?;
                }
                _ => {
                    return Err(MediaError::InvalidInput(
                        "unsupported derivative job type".into(),
                    ));
                }
            }
            handle.set_progress(JobStage::Done, 1.0, None);
            Ok(())
        }),
    })
}

#[tauri::command]
pub fn media_generate_thumbnail(
    state: State<'_, AppState>,
    input: MediaDerivativeInput,
) -> Result<JobSnapshot, String> {
    media_generate_derivative_inner(&state, input, JobType::Thumbnail).map_err(to_invoke_error)
}

#[tauri::command]
pub fn media_generate_waveform(
    state: State<'_, AppState>,
    input: MediaDerivativeInput,
) -> Result<JobSnapshot, String> {
    media_generate_derivative_inner(&state, input, JobType::Waveform).map_err(to_invoke_error)
}

#[tauri::command]
pub fn media_generate_proxy(
    state: State<'_, AppState>,
    input: MediaDerivativeInput,
) -> Result<JobSnapshot, String> {
    media_generate_derivative_inner(&state, input, JobType::Proxy).map_err(to_invoke_error)
}

fn media_generate_derivative_inner(
    state: &AppState,
    input: MediaDerivativeInput,
    job_type: JobType,
) -> AppResult<JobSnapshot> {
    let project = validate_project_bundle(state, &input.project_path)?;
    let asset_id: Uuid = input
        .asset_id
        .trim()
        .parse()
        .map_err(|_| AppError::InvalidInput("assetId must be a uuid".into()))?;
    let doc = load_project(&project)?;
    if doc.find_asset(&asset_id).is_none() {
        return Err(AppError::NotFound(format!("asset not found: {asset_id}")));
    }
    if job_type == JobType::Proxy {
        let _ = parse_scale_profile(input.profile.as_deref())?;
    }
    let id = submit_derivative_job(state, project, asset_id, job_type, input.profile);
    state
        .jobs
        .get(&id)
        .ok_or_else(|| AppError::Internal("job vanished after submit".into()))
}

#[tauri::command]
pub fn media_list_jobs(state: State<'_, AppState>) -> Result<Vec<JobSnapshot>, String> {
    Ok(state.jobs.list())
}

#[tauri::command]
pub fn media_cancel_job(
    state: State<'_, AppState>,
    input: MediaCancelJobInput,
) -> Result<JobSnapshot, String> {
    state
        .jobs
        .request_cancel(input.job_id.trim())
        .map_err(|e| to_invoke_error(media_err(e)))
}

#[tauri::command]
pub fn media_storage_summary(
    state: State<'_, AppState>,
    input: MediaProjectInput,
) -> Result<StorageSummary, String> {
    media_storage_summary_inner(&state, input).map_err(to_invoke_error)
}

fn media_storage_summary_inner(
    state: &AppState,
    input: MediaProjectInput,
) -> AppResult<StorageSummary> {
    let project = validate_project_bundle(state, &input.project_path)?;
    let media_bytes = dir_size(&project.join("media"));
    let proxies_bytes = dir_size(&project.join(PROXIES_DIR));
    let thumbnails_bytes = dir_size(&project.join(THUMBNAILS_DIR));
    let waveforms_bytes = dir_size(&project.join(WAVEFORMS_DIR));
    let cache_bytes = dir_size(&project.join("cache"));
    let total_bytes = dir_size(&project);
    let accounted = media_bytes
        .saturating_add(proxies_bytes)
        .saturating_add(thumbnails_bytes)
        .saturating_add(waveforms_bytes)
        .saturating_add(cache_bytes);
    Ok(StorageSummary {
        project_path: project.to_string_lossy().into_owned(),
        total_bytes,
        media_bytes,
        proxies_bytes,
        thumbnails_bytes,
        waveforms_bytes,
        cache_bytes,
        other_bytes: total_bytes.saturating_sub(accounted),
    })
}

#[tauri::command]
pub fn media_engine_status() -> Result<MediaEngineStatus, String> {
    Ok(media_engine_status_inner())
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaResolvePreviewInput {
    pub project_path: String,
    pub asset_id: String,
    #[serde(default)]
    pub prefer_proxy: bool,
    #[serde(default)]
    pub force_original: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaResolvePreviewResult {
    pub absolute_path: Option<String>,
    pub poster_path: Option<String>,
    pub kind: String,
    pub error: Option<String>,
}

/// Resolve a validated on-disk media path for Program/Source preview.
/// Frontend converts via Tauri `convertFileSrc` — never expose arbitrary paths.
#[tauri::command]
pub fn media_resolve_preview(
    state: State<'_, AppState>,
    input: MediaResolvePreviewInput,
) -> Result<MediaResolvePreviewResult, String> {
    media_resolve_preview_inner(&state, input).map_err(to_invoke_error)
}

fn media_resolve_preview_inner(
    state: &AppState,
    input: MediaResolvePreviewInput,
) -> AppResult<MediaResolvePreviewResult> {
    let project = validate_project_bundle(state, &input.project_path)?;
    let asset_id: Uuid = input
        .asset_id
        .trim()
        .parse()
        .map_err(|_| AppError::InvalidInput("assetId must be a uuid".into()))?;
    let doc = load_project(&project)?;
    let asset = doc
        .find_asset(&asset_id)
        .ok_or_else(|| AppError::NotFound(format!("asset not found: {asset_id}")))?;

    let poster_path = asset.thumbnail.as_ref().and_then(|t| {
        let p = project.join(&t.relative_path);
        p.exists().then(|| p.to_string_lossy().into_owned())
    });

    let proxy_path = if !input.force_original && input.prefer_proxy {
        asset.proxy.as_ref().and_then(|proxy| {
            let p = project.join(&proxy.relative_path);
            p.exists().then_some(p)
        })
    } else {
        None
    };

    let resolved = match proxy_path {
        Some(p) => p,
        None => resolve_asset_source(&project, asset).map_err(media_err)?,
    };

    if !resolved.exists() {
        return Ok(MediaResolvePreviewResult {
            absolute_path: None,
            poster_path,
            kind: asset.kind.clone(),
            error: Some("MISSING: media file not found on disk".into()),
        });
    }

    Ok(MediaResolvePreviewResult {
        absolute_path: Some(resolved.to_string_lossy().into_owned()),
        poster_path,
        kind: asset.kind.clone(),
        error: None,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaExportSequenceInput {
    pub project_path: String,
    pub sequence_id: String,
    pub output_file_name: String,
    /// "720p" | "1080p" | "4k"
    pub preset: Option<String>,
}

#[tauri::command]
pub fn media_export_sequence(
    state: State<'_, AppState>,
    input: MediaExportSequenceInput,
) -> Result<ExportResult, String> {
    media_export_sequence_inner(&state, input).map_err(to_invoke_error)
}

fn media_export_sequence_inner(
    state: &AppState,
    input: MediaExportSequenceInput,
) -> AppResult<ExportResult> {
    let project = validate_project_bundle(state, &input.project_path)?;
    let project_json_path = project.join("project.json");
    let raw = fs::read_to_string(&project_json_path).map_err(|e| AppError::Io(e.to_string()))?;
    let value: serde_json::Value =
        serde_json::from_str(&raw).map_err(|e| AppError::InvalidInput(e.to_string()))?;
    let preset = input.preset.unwrap_or_else(|| "1080p".into());
    export_sequence_mp4(
        &project,
        &value,
        input.sequence_id.trim(),
        input.output_file_name.trim(),
        preset.trim(),
    )
    .map_err(media_err)
}

fn media_engine_status_inner() -> MediaEngineStatus {
    let ffmpeg = locate_ffmpeg().ok();
    let ffprobe = locate_ffprobe().ok();
    MediaEngineStatus {
        ffmpeg_available: ffmpeg.is_some(),
        ffprobe_available: ffprobe.is_some(),
        ffmpeg_version: ffmpeg.as_ref().and_then(|p| tool_version(p)),
        ffprobe_version: ffprobe.as_ref().and_then(|p| tool_version(p)),
        ffmpeg_path: ffmpeg.map(|p| p.to_string_lossy().into_owned()),
        ffprobe_path: ffprobe.map(|p| p.to_string_lossy().into_owned()),
    }
}
