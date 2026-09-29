use crate::errors::{AppError, AppResult};

/// Shared IPC input checks used by Tauri commands (testable without GTK).
pub fn sanitize_project_name(name: &str) -> AppResult<String> {
    let trimmed = name.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidInput("project name is required".into()));
    }
    if trimmed.len() > 120 {
        return Err(AppError::InvalidInput(
            "project name exceeds 120 characters".into(),
        ));
    }
    if trimmed.contains("..")
        || trimmed.contains('/')
        || trimmed.contains('\\')
        || trimmed.contains('\0')
    {
        return Err(AppError::InvalidInput(
            "project name contains illegal path characters".into(),
        ));
    }
    Ok(trimmed.to_string())
}

pub fn require_nonempty(field: &str, value: &str) -> AppResult<()> {
    if value.trim().is_empty() {
        return Err(AppError::InvalidInput(format!("{field} is required")));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_traversal_project_names() {
        assert!(sanitize_project_name("../evil").is_err());
        assert!(sanitize_project_name("a/b").is_err());
        assert!(sanitize_project_name("").is_err());
    }

    #[test]
    fn accepts_plain_names() {
        assert_eq!(sanitize_project_name("  Demo  ").unwrap(), "Demo");
    }

    #[test]
    fn requires_workspace_id() {
        assert!(require_nonempty("workspace_id", "  ").is_err());
        assert!(require_nonempty("workspace_id", "ws-local").is_ok());
    }
}
