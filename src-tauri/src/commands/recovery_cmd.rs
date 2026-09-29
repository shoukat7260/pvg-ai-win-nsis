//! Thin Tauri wrappers around pvg-core autosave / recovery helpers.

use crate::errors::{to_invoke_error, AppError, AppResult};
use crate::filesystem::validate_path_under_roots;
use crate::project::{
    list_recovery, restore_autosave, write_autosave, AutosaveEntry, AutosaveWriteResult,
    ProjectDocument,
};
use crate::state::AppState;
use serde::Deserialize;
use std::path::{Path, PathBuf};
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutosaveWriteInput {
    pub project_path: String,
    pub document: Option<ProjectDocument>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecoveryListInput {
    pub project_path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RestoreAutosaveInput {
    pub project_path: String,
    pub autosave_name: String,
}

fn validate_project(state: &AppState, project_path: &str) -> AppResult<PathBuf> {
    if project_path.trim().is_empty() {
        return Err(AppError::InvalidInput("projectPath is required".into()));
    }
    validate_path_under_roots(Path::new(project_path.trim()), &state.path_policy())
}

#[tauri::command]
pub fn project_write_autosave(
    state: State<'_, AppState>,
    input: AutosaveWriteInput,
) -> Result<AutosaveWriteResult, String> {
    let project = validate_project(&state, &input.project_path).map_err(to_invoke_error)?;
    write_autosave(&project, input.document.as_ref()).map_err(to_invoke_error)
}

#[tauri::command]
pub fn project_list_recovery(
    state: State<'_, AppState>,
    input: RecoveryListInput,
) -> Result<Vec<AutosaveEntry>, String> {
    let project = validate_project(&state, &input.project_path).map_err(to_invoke_error)?;
    list_recovery(&project).map_err(to_invoke_error)
}

#[tauri::command]
pub fn project_restore_autosave(
    state: State<'_, AppState>,
    input: RestoreAutosaveInput,
) -> Result<pvg_core::ProjectBundleMeta, String> {
    let project = validate_project(&state, &input.project_path).map_err(to_invoke_error)?;
    let doc = restore_autosave(&project, &input.autosave_name).map_err(to_invoke_error)?;
    Ok(doc.to_meta(project.to_string_lossy()))
}
