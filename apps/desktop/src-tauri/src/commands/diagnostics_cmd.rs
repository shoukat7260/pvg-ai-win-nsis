use crate::diagnostics::{collect, DiagnosticsReport};
use crate::state::AppState;
use tauri::State;

#[tauri::command]
pub fn get_diagnostics(state: State<'_, AppState>) -> Result<DiagnosticsReport, String> {
    let data = state.data_root().to_string_lossy().into_owned();
    let workspace = state.workspace_root().to_string_lossy().into_owned();
    Ok(collect(&data, &workspace))
}
