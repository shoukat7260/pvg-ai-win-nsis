//! Output-path validation: cache/derivative paths must stay under the project root.
//! Reuses Phase 1 `pvg-core` PathPolicy (canonicalize + root containment + traversal reject).

use crate::error::{MediaError, MediaResult};
use pvg_core::{reject_traversal_components, validate_path_under_roots, PathPolicy};
use std::path::{Path, PathBuf};

/// Validate that `candidate` resolves under `project_root`.
pub fn validate_under_project(project_root: &Path, candidate: &Path) -> MediaResult<PathBuf> {
    let policy = PathPolicy::new(vec![project_root.to_path_buf()]);
    validate_path_under_roots(candidate, &policy).map_err(MediaError::from)
}

/// Join `relative` under `project_root` and validate the result stays inside the project.
/// Rejects absolute relatives and `..` segments before joining.
pub fn safe_join_under_project(project_root: &Path, relative: &Path) -> MediaResult<PathBuf> {
    if relative.is_absolute() {
        return Err(MediaError::PathRejected(
            "absolute paths are not allowed as relative cache segments".into(),
        ));
    }
    reject_traversal_components(relative).map_err(MediaError::from)?;
    let joined = project_root.join(relative);
    validate_under_project(project_root, &joined)
}

/// Ensure a derivative subdirectory (e.g. `thumbnails/`, `proxies/`) exists and is safe.
pub fn ensure_derivative_dir(project_root: &Path, dir_name: &str) -> MediaResult<PathBuf> {
    if dir_name.contains('/') || dir_name.contains('\\') || dir_name.contains("..") {
        return Err(MediaError::PathRejected(format!(
            "illegal derivative directory name: {dir_name}"
        )));
    }
    let dir = safe_join_under_project(project_root, Path::new(dir_name))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

/// Build a validated output file path under a derivative directory.
pub fn derivative_output_path(
    project_root: &Path,
    dir_name: &str,
    file_name: &str,
) -> MediaResult<PathBuf> {
    if file_name.contains('/') || file_name.contains('\\') || file_name.contains("..") {
        return Err(MediaError::PathRejected(format!(
            "illegal output file name: {file_name}"
        )));
    }
    let dir = ensure_derivative_dir(project_root, dir_name)?;
    let out = dir.join(file_name);
    validate_under_project(project_root, &out)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn rejects_path_escape_via_parent_segments() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("project");
        fs::create_dir_all(&root).unwrap();

        let err = safe_join_under_project(&root, Path::new("../outside.txt")).unwrap_err();
        assert!(matches!(err, MediaError::PathRejected(_)));
    }

    #[test]
    fn rejects_escape_in_file_name() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("project");
        fs::create_dir_all(&root).unwrap();

        let err = derivative_output_path(&root, "thumbnails", "../evil.jpg").unwrap_err();
        assert!(matches!(err, MediaError::PathRejected(_)));
    }

    #[test]
    fn accepts_safe_thumbnail_path() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("project");
        fs::create_dir_all(&root).unwrap();

        let out = derivative_output_path(&root, "thumbnails", "asset-1.jpg").unwrap();
        assert!(out.starts_with(root.canonicalize().unwrap().join("thumbnails")));
    }
}
