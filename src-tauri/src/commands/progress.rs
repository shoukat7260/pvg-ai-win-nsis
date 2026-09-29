//! Async progress event pattern stub for future long-running native ops.
//!
//! Future engines (render, AI, media) should:
//! 1. spawn work off the UI thread
//! 2. emit `pvg://progress` events with typed payloads
//! 3. support cancellation tokens where safe
//!
//! Phase 1 only validates the event plumbing.

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

pub const PROGRESS_EVENT: &str = "pvg://progress";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressEvent {
    pub operation_id: String,
    pub stage: String,
    pub percent: f32,
    pub message: String,
    pub done: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProgressStubInput {
    pub operation_id: String,
}

#[tauri::command]
pub fn emit_progress_stub(
    app: AppHandle,
    input: ProgressStubInput,
) -> Result<ProgressEvent, String> {
    let event = ProgressEvent {
        operation_id: input.operation_id,
        stage: "stub".into(),
        percent: 100.0,
        message: "Phase 1 progress stub — no long-running work yet".into(),
        done: true,
    };
    app.emit(PROGRESS_EVENT, event.clone())
        .map_err(|e| e.to_string())?;
    Ok(event)
}
