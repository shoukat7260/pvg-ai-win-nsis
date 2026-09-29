use crate::errors::{to_invoke_error, AppError, AppResult};
use pvg_core::{require_nonempty, sanitize_project_name};
use crate::filesystem::validate_path_under_roots;
use crate::project::{
    load_project, save_project as save_project_bundle, validate_project_data, ProjectBundleMeta,
    ProjectDocument,
};
use crate::state::AppState;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::State;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateProjectInput {
    pub name: String,
    pub workspace_id: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenProjectInput {
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadMetadataInput {
    pub path: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveProjectInput {
    pub path: String,
    pub document: ProjectDocument,
}

fn bundle_dir_for(workspace: &Path, name: &str) -> PathBuf {
    let safe = name.replace(' ', "-");
    workspace.join(format!("{safe}.pvg"))
}

#[tauri::command]
pub fn create_project(
    state: State<'_, AppState>,
    input: CreateProjectInput,
) -> Result<ProjectBundleMeta, String> {
    create_project_inner(&state, input).map_err(to_invoke_error)
}

fn create_project_inner(
    state: &AppState,
    input: CreateProjectInput,
) -> AppResult<ProjectBundleMeta> {
    let name = sanitize_project_name(&input.name)?;
    require_nonempty("workspace_id", &input.workspace_id)?;

    let workspace = state.workspace_root();
    fs::create_dir_all(&workspace)?;
    let bundle = bundle_dir_for(&workspace, &name);
    let policy = state.path_policy();
    let validated = validate_path_under_roots(&bundle, &policy)?;

    if validated.exists() {
        return Err(AppError::InvalidInput(format!(
            "project already exists at {}",
            validated.display()
        )));
    }

    let mut doc = ProjectDocument::new(&name, input.workspace_id.trim());
    doc.description = input.description;
    validate_project_data(&doc)?;
    save_project_bundle(&validated, &doc)?;
    Ok(doc.to_meta(validated.to_string_lossy()))
}

#[tauri::command]
pub fn open_project(
    state: State<'_, AppState>,
    input: OpenProjectInput,
) -> Result<ProjectBundleMeta, String> {
    open_project_inner(&state, input).map_err(to_invoke_error)
}

fn open_project_inner(
    state: &AppState,
    input: OpenProjectInput,
) -> AppResult<ProjectBundleMeta> {
    if input.path.trim().is_empty() {
        return Err(AppError::InvalidInput("path is required".into()));
    }
    let path = PathBuf::from(input.path.trim());
    let validated = validate_path_under_roots(&path, &state.path_policy())?;
    if !validated.exists() {
        return Err(AppError::NotFound(format!(
            "project not found: {}",
            validated.display()
        )));
    }
    let doc = load_project(&validated)?;
    Ok(doc.to_meta(validated.to_string_lossy()))
}

#[tauri::command]
pub fn load_project_document(
    state: State<'_, AppState>,
    input: OpenProjectInput,
) -> Result<serde_json::Value, String> {
    load_project_document_inner(&state, input).map_err(to_invoke_error)
}

fn load_project_document_inner(
    state: &AppState,
    input: OpenProjectInput,
) -> AppResult<serde_json::Value> {
    if input.path.trim().is_empty() {
        return Err(AppError::InvalidInput("path is required".into()));
    }
    let path = PathBuf::from(input.path.trim());
    let validated = validate_path_under_roots(&path, &state.path_policy())?;
    if !validated.exists() {
        return Err(AppError::NotFound(format!(
            "project not found: {}",
            validated.display()
        )));
    }
    let doc = load_project(&validated)?;
    serde_json::to_value(&doc).map_err(|e| AppError::Internal(e.to_string()))
}

#[tauri::command]
pub fn read_project_metadata(
    state: State<'_, AppState>,
    input: ReadMetadataInput,
) -> Result<ProjectBundleMeta, String> {
    open_project_inner(
        &state,
        OpenProjectInput {
            path: input.path,
        },
    )
    .map_err(to_invoke_error)
}

#[tauri::command]
pub fn save_project(
    state: State<'_, AppState>,
    input: SaveProjectInput,
) -> Result<ProjectBundleMeta, String> {
    save_project_inner(&state, input).map_err(to_invoke_error)
}

fn save_project_inner(
    state: &AppState,
    input: SaveProjectInput,
) -> AppResult<ProjectBundleMeta> {
    if input.path.trim().is_empty() {
        return Err(AppError::InvalidInput("path is required".into()));
    }
    validate_project_data(&input.document)?;
    let path = PathBuf::from(input.path.trim());
    let validated = validate_path_under_roots(&path, &state.path_policy())?;
    save_project_bundle(&validated, &input.document)?;
    let doc = load_project(&validated)?;
    Ok(doc.to_meta(validated.to_string_lossy()))
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceProjects {
    pub workspace_root: String,
    pub projects: Vec<ProjectBundleMeta>,
}

#[tauri::command]
pub fn list_workspace_projects(
    state: State<'_, AppState>,
) -> Result<WorkspaceProjects, String> {
    list_workspace_projects_inner(&state).map_err(to_invoke_error)
}

fn list_workspace_projects_inner(state: &AppState) -> AppResult<WorkspaceProjects> {
    let root = state.workspace_root();
    fs::create_dir_all(&root)?;
    let mut projects = Vec::new();
    if root.is_dir() {
        for entry in fs::read_dir(&root)? {
            let entry = entry?;
            let path = entry.path();
            if path.is_dir()
                && path
                    .extension()
                    .and_then(|e| e.to_str())
                    .is_some_and(|e| e.eq_ignore_ascii_case("pvg"))
            {
                match load_project(&path) {
                    Ok(doc) => projects.push(doc.to_meta(path.to_string_lossy())),
                    Err(err) => {
                        tracing::warn!(
                            "skipping invalid project at {}: {err}",
                            path.display()
                        );
                    }
                }
            }
        }
    }
    projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(WorkspaceProjects {
        workspace_root: root.to_string_lossy().into_owned(),
        projects,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::AppState;
    use tempfile::tempdir;

    #[test]
    fn create_and_open_project_round_trip() {
        let dir = tempdir().unwrap();
        let state = AppState::with_roots(dir.path().to_path_buf()).unwrap();
        state.bootstrap_roots().unwrap();

        let meta = create_project_inner(
            &state,
            CreateProjectInput {
                name: "Foundation Demo".into(),
                workspace_id: "ws-local".into(),
                description: "Phase 1".into(),
            },
        )
        .unwrap();

        assert!(meta.path.ends_with("Foundation-Demo.pvg"));
        let opened = open_project_inner(
            &state,
            OpenProjectInput {
                path: meta.path.clone(),
            },
        )
        .unwrap();
        assert_eq!(opened.id, meta.id);
        assert_eq!(opened.name, "Foundation Demo");
    }

    #[test]
    fn rejects_invalid_project_name() {
        let dir = tempdir().unwrap();
        let state = AppState::with_roots(dir.path().to_path_buf()).unwrap();
        state.bootstrap_roots().unwrap();
        let err = create_project_inner(
            &state,
            CreateProjectInput {
                name: "../evil".into(),
                workspace_id: "ws-local".into(),
                description: String::new(),
            },
        )
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }

    #[test]
    fn rejects_empty_workspace_id() {
        let dir = tempdir().unwrap();
        let state = AppState::with_roots(dir.path().to_path_buf()).unwrap();
        state.bootstrap_roots().unwrap();
        let err = create_project_inner(
            &state,
            CreateProjectInput {
                name: "Ok".into(),
                workspace_id: "  ".into(),
                description: String::new(),
            },
        )
        .unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }
}
