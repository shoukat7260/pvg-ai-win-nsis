use crate::errors::{to_invoke_error, AppResult};
use crate::state::AppState;
use serde::Serialize;
use tauri::State;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalWorkspaceInfo {
    pub workspace_id: String,
    pub display_name: String,
    pub data_root: String,
    pub projects_root: String,
    pub user_id: String,
}

#[tauri::command]
pub fn ensure_local_workspace(
    state: State<'_, AppState>,
) -> Result<LocalWorkspaceInfo, String> {
    ensure_local_workspace_inner(&state).map_err(to_invoke_error)
}

fn ensure_local_workspace_inner(state: &AppState) -> AppResult<LocalWorkspaceInfo> {
    state.bootstrap_roots()?;
    Ok(LocalWorkspaceInfo {
        workspace_id: "ws-local".into(),
        display_name: "Local Test Workspace".into(),
        data_root: state.data_root().to_string_lossy().into_owned(),
        projects_root: state.workspace_root().to_string_lossy().into_owned(),
        user_id: "local".into(),
    })
}
