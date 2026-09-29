use serde::Serialize;
use thiserror::Error;

/// Typed media-engine errors. Never include secrets in messages.
#[derive(Debug, Error, Clone, Serialize, PartialEq, Eq)]
#[serde(tag = "kind", content = "message")]
pub enum MediaError {
    #[error("media engine unavailable: {0}")]
    EngineUnavailable(String),
    #[error("path rejected: {0}")]
    PathRejected(String),
    #[error("invalid input: {0}")]
    InvalidInput(String),
    #[error("probe failed: {0}")]
    ProbeFailed(String),
    #[error("ffmpeg failed: {0}")]
    FfmpegFailed(String),
    #[error("io error: {0}")]
    Io(String),
    #[error("job cancelled")]
    JobCancelled,
    #[error("job failed: {0}")]
    JobFailed(String),
    #[error("internal error: {0}")]
    Internal(String),
}

impl From<std::io::Error> for MediaError {
    fn from(value: std::io::Error) -> Self {
        MediaError::Io(value.to_string())
    }
}

impl From<pvg_core::AppError> for MediaError {
    fn from(value: pvg_core::AppError) -> Self {
        match value {
            pvg_core::AppError::PathRejected(msg) => MediaError::PathRejected(msg),
            pvg_core::AppError::InvalidInput(msg) => MediaError::InvalidInput(msg),
            pvg_core::AppError::Io(msg) => MediaError::Io(msg),
            other => MediaError::Internal(other.to_string()),
        }
    }
}

pub type MediaResult<T> = Result<T, MediaError>;
