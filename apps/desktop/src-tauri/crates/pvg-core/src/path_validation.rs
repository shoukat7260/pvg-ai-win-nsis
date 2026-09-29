use crate::errors::{AppError, AppResult};
use std::path::{Component, Path, PathBuf};

/// Policy for validating filesystem paths against allowed roots.
#[derive(Debug, Clone)]
pub struct PathPolicy {
    pub allowed_roots: Vec<PathBuf>,
}

impl PathPolicy {
    pub fn new(allowed_roots: Vec<PathBuf>) -> Self {
        Self { allowed_roots }
    }
}

/// Reject path components that attempt traversal or absolute escapes in relative segments.
pub fn reject_traversal_components(path: &Path) -> AppResult<()> {
    for component in path.components() {
        match component {
            Component::ParentDir => {
                return Err(AppError::PathRejected(
                    "parent directory segments (..) are not allowed".into(),
                ));
            }
            Component::RootDir | Component::Prefix(_) => {
                // Absolute / prefixed paths are handled after canonicalize against roots.
            }
            Component::CurDir | Component::Normal(_) => {}
        }
    }

    let raw = path.to_string_lossy();
    if raw.contains("..") {
        // Catch mixed separators / encoded forms before canonicalize.
        if raw.split(|c| c == '/' || c == '\\').any(|seg| seg == "..") {
            return Err(AppError::PathRejected(
                "path traversal segment detected".into(),
            ));
        }
    }

    Ok(())
}

/// Reject Windows UNC / device paths and remote shares.
pub fn is_unc_or_device_path(path: &Path) -> bool {
    let raw = path.to_string_lossy();
    let lower = raw.to_ascii_lowercase();
    raw.starts_with("\\\\")
        || raw.starts_with("//")
        || lower.starts_with("\\\\?\\")
        || lower.starts_with("//?/")
        || lower.starts_with("\\\\.\\")
        || lower.contains("unc\\")
}

/// Canonicalize when the path exists; otherwise canonicalize the parent and join the final name.
pub fn canonicalize_checked(path: &Path) -> AppResult<PathBuf> {
    if is_unc_or_device_path(path) {
        return Err(AppError::PathRejected(
            "UNC / device paths are not allowed".into(),
        ));
    }

    reject_traversal_components(path)?;

    if path.exists() {
        return path
            .canonicalize()
            .map_err(|e| AppError::PathRejected(format!("canonicalize failed: {e}")));
    }

    // For create flows: validate parent chain.
    let parent = path.parent().ok_or_else(|| {
        AppError::PathRejected("path has no parent for canonicalize".into())
    })?;
    let file_name = path.file_name().ok_or_else(|| {
        AppError::PathRejected("path has no file name".into())
    })?;

    if is_unc_or_device_path(parent) {
        return Err(AppError::PathRejected(
            "UNC / device parent paths are not allowed".into(),
        ));
    }

    let parent_canon = if parent.exists() {
        parent.canonicalize().map_err(|e| {
            AppError::PathRejected(format!("parent canonicalize failed: {e}"))
        })?
    } else {
        // Walk up until an existing ancestor is found.
        let mut cursor = parent.to_path_buf();
        let mut missing = Vec::new();
        while !cursor.exists() {
            let name = cursor
                .file_name()
                .ok_or_else(|| AppError::PathRejected("invalid parent chain".into()))?
                .to_os_string();
            missing.push(name);
            cursor = cursor
                .parent()
                .ok_or_else(|| AppError::PathRejected("escaped past filesystem root".into()))?
                .to_path_buf();
            if is_unc_or_device_path(&cursor) {
                return Err(AppError::PathRejected(
                    "UNC / device paths are not allowed".into(),
                ));
            }
        }
        let mut canon = cursor.canonicalize().map_err(|e| {
            AppError::PathRejected(format!("ancestor canonicalize failed: {e}"))
        })?;
        for part in missing.into_iter().rev() {
            reject_name(&part)?;
            canon.push(part);
        }
        canon
    };

    reject_name(file_name)?;
    Ok(parent_canon.join(file_name))
}

fn reject_name(name: &std::ffi::OsStr) -> AppResult<()> {
    let s = name.to_string_lossy();
    if s.is_empty() || s == "." || s == ".." || s.contains('\0') {
        return Err(AppError::PathRejected(format!(
            "illegal path segment: {s}"
        )));
    }
    Ok(())
}

/// Ensure `candidate` is equal to or contained within one of `roots` after canonicalization.
pub fn assert_within_roots(candidate: &Path, roots: &[PathBuf]) -> AppResult<()> {
    if roots.is_empty() {
        return Err(AppError::Internal(
            "no allowed roots configured".into(),
        ));
    }

    for root in roots {
        let root_canon = if root.exists() {
            root.canonicalize().map_err(|e| {
                AppError::PathRejected(format!("root canonicalize failed: {e}"))
            })?
        } else {
            root.to_path_buf()
        };

        if candidate == root_canon || candidate.starts_with(&root_canon) {
            return Ok(());
        }
    }

    Err(AppError::PathRejected(
        "path escapes allowed workspace roots".into(),
    ))
}

/// Full validation pipeline used by IPC commands.
pub fn validate_path_under_roots(path: &Path, policy: &PathPolicy) -> AppResult<PathBuf> {
    if is_unc_or_device_path(path) {
        return Err(AppError::PathRejected(
            "UNC / device paths are not allowed".into(),
        ));
    }
    reject_traversal_components(path)?;
    let canon = canonicalize_checked(path)?;
    assert_within_roots(&canon, &policy.allowed_roots)?;
    Ok(canon)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn rejects_parent_dir_components() {
        let err = reject_traversal_components(Path::new("foo/../bar")).unwrap_err();
        assert!(err.to_string().contains("parent") || err.to_string().contains("traversal"));
    }

    #[test]
    fn rejects_unc_paths() {
        assert!(is_unc_or_device_path(Path::new(r"\\server\share")));
        assert!(is_unc_or_device_path(Path::new("//server/share")));
        assert!(is_unc_or_device_path(Path::new(r"\\?\C:\Windows")));
    }

    #[test]
    fn accepts_path_inside_root() {
        let dir = tempdir().unwrap();
        let root = dir.path().to_path_buf();
        let child = root.join("projects").join("demo.pvg");
        fs::create_dir_all(child.parent().unwrap()).unwrap();
        fs::write(&child, "{}").unwrap();

        let policy = PathPolicy::new(vec![root.clone()]);
        let validated = validate_path_under_roots(&child, &policy).unwrap();
        assert!(validated.starts_with(root.canonicalize().unwrap()));
    }

    #[test]
    fn rejects_escape_outside_root() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("allowed");
        fs::create_dir_all(&root).unwrap();
        let outside = dir.path().join("secret.txt");
        fs::write(&outside, "nope").unwrap();

        let policy = PathPolicy::new(vec![root]);
        let err = validate_path_under_roots(&outside, &policy).unwrap_err();
        assert!(err.to_string().contains("escapes") || err.to_string().contains("rejected"));
    }

    #[test]
    fn rejects_symlink_escape_when_possible() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("allowed");
        let outside = dir.path().join("outside");
        fs::create_dir_all(&root).unwrap();
        fs::create_dir_all(&outside).unwrap();
        let target = outside.join("leak.txt");
        fs::write(&target, "secret").unwrap();

        let link = root.join("sneaky");
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(&outside, &link).unwrap();
            let sneak = link.join("leak.txt");
            let policy = PathPolicy::new(vec![root.clone()]);
            let result = validate_path_under_roots(&sneak, &policy);
            // Canonicalize follows symlink; path should fall outside root.
            assert!(result.is_err());
        }
    }

    #[test]
    fn rejects_absolute_escape_via_joined_segments() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("ws");
        fs::create_dir_all(&root).unwrap();
        let evil = PathBuf::from("/etc/passwd");
        let policy = PathPolicy::new(vec![root]);
        let err = validate_path_under_roots(&evil, &policy).unwrap_err();
        assert!(matches!(err, AppError::PathRejected(_)));
    }
}
