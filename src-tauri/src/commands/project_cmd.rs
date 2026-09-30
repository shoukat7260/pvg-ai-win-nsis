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

fn resolve_thumbnail_path(bundle: &Path, doc: &ProjectDocument) -> Option<String> {
    if let Some(rel) = doc.cover_relative_path() {
        let p = bundle.join(rel);
        if p.is_file() {
            return Some(p.to_string_lossy().into_owned());
        }
    }
    let cover = bundle.join("thumbnails").join("project-cover.jpg");
    if cover.is_file() {
        return Some(cover.to_string_lossy().into_owned());
    }
    // First asset thumbnail under thumbnails/
    let thumbs = bundle.join("thumbnails");
    if thumbs.is_dir() {
        if let Ok(rd) = fs::read_dir(&thumbs) {
            let mut jpgs: Vec<PathBuf> = rd
                .filter_map(|e| e.ok())
                .map(|e| e.path())
                .filter(|p| {
                    p.extension()
                        .and_then(|e| e.to_str())
                        .is_some_and(|e| e.eq_ignore_ascii_case("jpg") || e.eq_ignore_ascii_case("jpeg") || e.eq_ignore_ascii_case("png"))
                })
                .collect();
            jpgs.sort();
            if let Some(first) = jpgs.first() {
                return Some(first.to_string_lossy().into_owned());
            }
        }
    }
    // Asset derivative refs
    for asset in &doc.assets {
        if let Some(t) = &asset.thumbnail {
            let p = bundle.join(&t.relative_path);
            if p.is_file() {
                return Some(p.to_string_lossy().into_owned());
            }
        }
    }
    None
}

fn meta_for_bundle(bundle: &Path, doc: &ProjectDocument, trashed: bool) -> ProjectBundleMeta {
    let thumb = resolve_thumbnail_path(bundle, doc);
    doc.to_meta_ex(bundle.to_string_lossy(), thumb, trashed)
}

fn list_pvg_dirs(root: &Path, trashed: bool) -> AppResult<Vec<ProjectBundleMeta>> {
    let mut projects = Vec::new();
    if !root.is_dir() {
        return Ok(projects);
    }
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir()
            && path
                .extension()
                .and_then(|e| e.to_str())
                .is_some_and(|e| e.eq_ignore_ascii_case("pvg"))
        {
            match load_project(&path) {
                Ok(doc) => projects.push(meta_for_bundle(&path, &doc, trashed)),
                Err(err) => {
                    tracing::warn!("skipping invalid project at {}: {err}", path.display());
                }
            }
        }
    }
    projects.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(projects)
}

fn list_workspace_projects_inner(state: &AppState) -> AppResult<WorkspaceProjects> {
    let root = state.workspace_root();
    fs::create_dir_all(&root)?;
    let projects = list_pvg_dirs(&root, false)?;
    Ok(WorkspaceProjects {
        workspace_root: root.to_string_lossy().into_owned(),
        projects,
    })
}


fn copy_dir_recursive(src: &Path, dst: &Path) -> AppResult<()> {
    fs::create_dir_all(dst)?;
    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let from = entry.path();
        let to = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_recursive(&from, &to)?;
        } else if ty.is_file() {
            fs::copy(&from, &to)?;
        }
    }
    Ok(())
}

fn unique_bundle_path(workspace: &Path, name: &str) -> PathBuf {
    let base = bundle_dir_for(workspace, name);
    if !base.exists() {
        return base;
    }
    for i in 2..10_000 {
        let candidate = workspace.join(format!(
            "{}.pvg",
            format!("{}-{}", name.replace(' ', "-"), i)
        ));
        if !candidate.exists() {
            return candidate;
        }
    }
    base
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenameProjectInput {
    pub path: String,
    pub name: String,
}

#[tauri::command]
pub fn rename_project(
    state: State<'_, AppState>,
    input: RenameProjectInput,
) -> Result<ProjectBundleMeta, String> {
    rename_project_inner(&state, input).map_err(to_invoke_error)
}

fn rename_project_inner(state: &AppState, input: RenameProjectInput) -> AppResult<ProjectBundleMeta> {
    let new_name = sanitize_project_name(&input.name)?;
    let path = PathBuf::from(input.path.trim());
    let validated = validate_path_under_roots(&path, &state.path_policy())?;
    if !validated.exists() {
        return Err(AppError::NotFound(format!("project not found: {}", validated.display())));
    }
    let mut doc = load_project(&validated)?;
    doc.name = new_name.clone();
    doc.updated_at = chrono::Utc::now();
    save_project_bundle(&validated, &doc)?;

    let parent = validated
        .parent()
        .ok_or_else(|| AppError::Internal("project has no parent".into()))?
        .to_path_buf();
    let target = unique_bundle_path(&parent, &new_name);
    if target != validated {
        if target.exists() {
            return Err(AppError::InvalidInput(format!(
                "project already exists at {}",
                target.display()
            )));
        }
        fs::rename(&validated, &target)?;
        let doc = load_project(&target)?;
        return Ok(meta_for_bundle(&target, &doc, false));
    }
    Ok(meta_for_bundle(&validated, &doc, false))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DuplicateProjectInput {
    pub path: String,
    #[serde(default)]
    pub name: Option<String>,
}

#[tauri::command]
pub fn duplicate_project(
    state: State<'_, AppState>,
    input: DuplicateProjectInput,
) -> Result<ProjectBundleMeta, String> {
    duplicate_project_inner(&state, input).map_err(to_invoke_error)
}

fn duplicate_project_inner(
    state: &AppState,
    input: DuplicateProjectInput,
) -> AppResult<ProjectBundleMeta> {
    let path = PathBuf::from(input.path.trim());
    let validated = validate_path_under_roots(&path, &state.path_policy())?;
    if !validated.exists() {
        return Err(AppError::NotFound(format!("project not found: {}", validated.display())));
    }
    let src = load_project(&validated)?;
    let new_name = sanitize_project_name(
        input
            .name
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or(&format!("{} Copy", src.name)),
    )?;
    let workspace = state.workspace_root();
    fs::create_dir_all(&workspace)?;
    let dest = unique_bundle_path(&workspace, &new_name);
    let validated_dest = validate_path_under_roots(&dest, &state.path_policy())?;
    if validated_dest.exists() {
        return Err(AppError::InvalidInput(format!(
            "project already exists at {}",
            validated_dest.display()
        )));
    }
    copy_dir_recursive(&validated, &validated_dest)?;
    let mut doc = load_project(&validated_dest)?;
    doc.id = uuid::Uuid::new_v4();
    doc.name = new_name;
    doc.updated_at = chrono::Utc::now();
    doc.created_at = chrono::Utc::now();
    save_project_bundle(&validated_dest, &doc)?;
    Ok(meta_for_bundle(&validated_dest, &doc, false))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectPathInput {
    pub path: String,
}

#[tauri::command]
pub fn trash_project(
    state: State<'_, AppState>,
    input: ProjectPathInput,
) -> Result<ProjectBundleMeta, String> {
    trash_project_inner(&state, input).map_err(to_invoke_error)
}

fn trash_project_inner(state: &AppState, input: ProjectPathInput) -> AppResult<ProjectBundleMeta> {
    let path = PathBuf::from(input.path.trim());
    let validated = validate_path_under_roots(&path, &state.path_policy())?;
    if !validated.exists() {
        return Err(AppError::NotFound(format!("project not found: {}", validated.display())));
    }
    let trash = state.trash_root();
    fs::create_dir_all(&trash)?;
    let name = validated
        .file_name()
        .ok_or_else(|| AppError::Internal("invalid project path".into()))?;
    let mut dest = trash.join(name);
    if dest.exists() {
        let stem = validated
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("project");
        dest = trash.join(format!(
            "{}-{}.pvg",
            stem,
            chrono::Utc::now().timestamp()
        ));
    }
    let dest = validate_path_under_roots(&dest, &state.path_policy())?;
    fs::rename(&validated, &dest)?;
    let doc = load_project(&dest)?;
    Ok(meta_for_bundle(&dest, &doc, true))
}

#[tauri::command]
pub fn restore_project(
    state: State<'_, AppState>,
    input: ProjectPathInput,
) -> Result<ProjectBundleMeta, String> {
    restore_project_inner(&state, input).map_err(to_invoke_error)
}

fn restore_project_inner(state: &AppState, input: ProjectPathInput) -> AppResult<ProjectBundleMeta> {
    let path = PathBuf::from(input.path.trim());
    let validated = validate_path_under_roots(&path, &state.path_policy())?;
    if !validated.exists() {
        return Err(AppError::NotFound(format!("project not found: {}", validated.display())));
    }
    let trash = state.trash_root();
    if !validated.starts_with(&trash) {
        return Err(AppError::InvalidInput("project is not in trash".into()));
    }
    let workspace = state.workspace_root();
    fs::create_dir_all(&workspace)?;
    let doc = load_project(&validated)?;
    let dest = unique_bundle_path(&workspace, &doc.name);
    let dest = validate_path_under_roots(&dest, &state.path_policy())?;
    if dest.exists() {
        return Err(AppError::InvalidInput(format!(
            "cannot restore: {} already exists",
            dest.display()
        )));
    }
    fs::rename(&validated, &dest)?;
    let doc = load_project(&dest)?;
    Ok(meta_for_bundle(&dest, &doc, false))
}

#[tauri::command]
pub fn delete_project_permanent(
    state: State<'_, AppState>,
    input: ProjectPathInput,
) -> Result<bool, String> {
    delete_project_permanent_inner(&state, input).map_err(to_invoke_error)
}

fn delete_project_permanent_inner(state: &AppState, input: ProjectPathInput) -> AppResult<bool> {
    let path = PathBuf::from(input.path.trim());
    let validated = validate_path_under_roots(&path, &state.path_policy())?;
    if !validated.exists() {
        return Err(AppError::NotFound(format!("project not found: {}", validated.display())));
    }
    let trash = state.trash_root();
    if !validated.starts_with(&trash) {
        return Err(AppError::InvalidInput(
            "permanent delete is only allowed for trashed projects".into(),
        ));
    }
    fs::remove_dir_all(&validated)?;
    Ok(true)
}

#[tauri::command]
pub fn list_trashed_projects(
    state: State<'_, AppState>,
) -> Result<WorkspaceProjects, String> {
    list_trashed_projects_inner(&state).map_err(to_invoke_error)
}

fn list_trashed_projects_inner(state: &AppState) -> AppResult<WorkspaceProjects> {
    let trash = state.trash_root();
    fs::create_dir_all(&trash)?;
    let projects = list_pvg_dirs(&trash, true)?;
    Ok(WorkspaceProjects {
        workspace_root: trash.to_string_lossy().into_owned(),
        projects,
    })
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateProjectThumbnailInput {
    pub path: String,
    /// Optional absolute media path to use as cover source. When omitted, first visual asset is used.
    #[serde(default)]
    pub source_path: Option<String>,
}

#[tauri::command]
pub fn generate_project_thumbnail(
    state: State<'_, AppState>,
    input: GenerateProjectThumbnailInput,
) -> Result<ProjectBundleMeta, String> {
    generate_project_thumbnail_inner(&state, input).map_err(to_invoke_error)
}

fn generate_project_thumbnail_inner(
    state: &AppState,
    input: GenerateProjectThumbnailInput,
) -> AppResult<ProjectBundleMeta> {
    use pvg_media::{generate_thumbnail, ThumbnailOptions};

    let path = PathBuf::from(input.path.trim());
    let validated = validate_path_under_roots(&path, &state.path_policy())?;
    if !validated.exists() {
        return Err(AppError::NotFound(format!("project not found: {}", validated.display())));
    }
    let mut doc = load_project(&validated)?;

    let source = if let Some(src) = input.source_path.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        PathBuf::from(src)
    } else {
        // Prefer first asset with a resolvable local file.
        let mut found: Option<PathBuf> = None;
        for asset in &doc.assets {
            let candidate = match &asset.location {
                Some(pvg_core::MediaLocation::Link { absolute_path }) => {
                    PathBuf::from(absolute_path)
                }
                Some(pvg_core::MediaLocation::Copy { relative_path }) => {
                    validated.join(relative_path)
                }
                None => validated.join(&asset.relative_path),
            };
            if candidate.is_file() {
                found = Some(candidate);
                break;
            }
        }
        found.ok_or_else(|| {
            AppError::InvalidInput("no usable media found to generate a project thumbnail".into())
        })?
    };

    if !source.is_file() {
        return Err(AppError::NotFound(format!(
            "thumbnail source not found: {}",
            source.display()
        )));
    }

    let _out = generate_thumbnail(
        &validated,
        &source,
        "project-cover",
        &ThumbnailOptions {
            max_width: 640,
            quality: 4,
        },
    )
    .map_err(|e| AppError::Internal(e.to_string()))?;

    let rel = "thumbnails/project-cover.jpg".to_string();
    doc.set_cover_relative_path(Some(rel));
    doc.updated_at = chrono::Utc::now();
    save_project_bundle(&validated, &doc)?;
    Ok(meta_for_bundle(
        &validated,
        &doc,
        validated.starts_with(state.trash_root()),
    ))
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
