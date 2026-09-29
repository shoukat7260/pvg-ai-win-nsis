use serde::Serialize;
use thiserror::Error;

/// Typed IPC / domain errors for Phase 1. Never include secrets in messages.
#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum AppError {
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("path rejected: {0}")]
    PathRejected(String),
    #[error("project invalid: {0}")]
    ProjectInvalid(String),
    #[error("project corrupt: {0}")]
    ProjectCorrupt(String),
    #[error("unsupported schema version: {0}")]
    UnsupportedSchemaVersion(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("io error: {0}")]
    Io(String),
    #[error("vault error: {0}")]
    Vault(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl From<std::io::Error> for AppError {
    fn from(value: std::io::Error) -> Self {
        AppError::Io(value.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(value: serde_json::Error) -> Self {
        AppError::ProjectCorrupt(value.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;

/// Tauri expects `Result<T, String>` or Serialize errors; map to string for invoke.
pub fn to_invoke_error(err: AppError) -> String {
    err.to_string()
}
