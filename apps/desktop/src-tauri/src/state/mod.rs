use crate::errors::{AppError, AppResult};
use crate::filesystem::PathPolicy;
use crate::security::{create_vault, CredentialVault};
use parking_lot::RwLock;
use pvg_media::JobManager;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

/// Shared native application state (Phase 3 media + Phase 2 vault).
pub struct AppState {
    pub data_root: RwLock<PathBuf>,
    pub workspace_root: RwLock<PathBuf>,
    pub vault: Arc<dyn CredentialVault>,
    /// Shared media job queue (probe / thumbnail / waveform / proxy).
    pub jobs: Arc<JobManager>,
}

impl AppState {
    pub fn new() -> Self {
        Self::with_roots(resolve_data_root()).expect("default data root")
    }

    pub fn with_roots(data_root: PathBuf) -> AppResult<Self> {
        if data_root.as_os_str().is_empty() {
            return Err(AppError::InvalidInput("data_root empty".into()));
        }
        let workspace_root = data_root.join("users").join("local").join("projects");
        Ok(Self {
            data_root: RwLock::new(data_root),
            workspace_root: RwLock::new(workspace_root),
            vault: create_vault(),
            jobs: Arc::new(JobManager::new(2)),
        })
    }

    pub fn bootstrap_roots(&self) -> AppResult<()> {
        let data = self.data_root();
        fs::create_dir_all(data.join("users").join("local").join("projects"))?;
        fs::create_dir_all(data.join("users").join("local").join("assets"))?;
        fs::create_dir_all(data.join("users").join("local").join("cache"))?;
        fs::create_dir_all(data.join("users").join("local").join("backups"))?;
        fs::create_dir_all(data.join("users").join("local").join("metadata"))?;
        fs::create_dir_all(self.workspace_root())?;
        Ok(())
    }

    pub fn path_policy(&self) -> PathPolicy {
        PathPolicy::new(vec![self.data_root(), self.workspace_root()])
    }

    pub fn workspace_root(&self) -> PathBuf {
        self.workspace_root.read().clone()
    }

    pub fn data_root(&self) -> PathBuf {
        self.data_root.read().clone()
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// Local data root: `$XDG_DATA_HOME/PVG` (or platform equivalent) / `./PVG` fallback.
pub fn resolve_data_root() -> PathBuf {
    dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("PVG")
}
