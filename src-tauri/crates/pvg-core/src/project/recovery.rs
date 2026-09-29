//! Autosave / crash-recovery helpers for project.json snapshots.
//!
//! Snapshots live under `{bundle}/backups/autosave-*.json` with bounded retention.

use crate::errors::{AppError, AppResult};
use crate::project::{load_project, save_project, validate_project_data, ProjectDocument};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

pub const AUTOSAVE_PREFIX: &str = "autosave-";
pub const AUTOSAVE_SUFFIX: &str = ".json";
pub const MAX_AUTOSAVES: usize = 5;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutosaveEntry {
    pub name: String,
    pub path: String,
    pub modified_ms: Option<i64>,
    pub byte_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct AutosaveWriteResult {
    pub path: String,
    pub name: String,
}

pub fn is_autosave_name(name: &str) -> bool {
    name.starts_with(AUTOSAVE_PREFIX)
        && name.ends_with(AUTOSAVE_SUFFIX)
        && !name.contains('/')
        && !name.contains('\\')
        && !name.contains("..")
}

fn backups_dir(project: &Path) -> PathBuf {
    project.join("backups")
}

fn list_autosave_files(backups: &Path) -> AppResult<Vec<(PathBuf, std::fs::Metadata)>> {
    let mut entries = Vec::new();
    if !backups.is_dir() {
        return Ok(entries);
    }
    for entry in fs::read_dir(backups)? {
        let entry = entry?;
        let name = entry.file_name().to_string_lossy().into_owned();
        if !is_autosave_name(&name) {
            continue;
        }
        let path = entry.path();
        if path.is_file() {
            if let Ok(meta) = entry.metadata() {
                entries.push((path, meta));
            }
        }
    }
    entries.sort_by(|a, b| {
        let ta = a.1.modified().ok();
        let tb = b.1.modified().ok();
        tb.cmp(&ta)
    });
    Ok(entries)
}

fn prune_autosaves(backups: &Path) -> AppResult<()> {
    let entries = list_autosave_files(backups)?;
    for (path, _) in entries.into_iter().skip(MAX_AUTOSAVES) {
        let _ = fs::remove_file(path);
    }
    Ok(())
}

fn meta_to_ms(meta: &std::fs::Metadata) -> Option<i64> {
    meta.modified().ok().and_then(|t| {
        t.duration_since(std::time::UNIX_EPOCH)
            .ok()
            .map(|d| d.as_millis() as i64)
    })
}

/// Write an autosave snapshot; prunes to [`MAX_AUTOSAVES`].
pub fn write_autosave(
    project_path: &Path,
    document: Option<&ProjectDocument>,
) -> AppResult<AutosaveWriteResult> {
    let doc = match document {
        Some(doc) => {
            validate_project_data(doc)?;
            doc.clone()
        }
        None => load_project(project_path)?,
    };

    let backups = backups_dir(project_path);
    fs::create_dir_all(&backups)?;
    let stamp = Utc::now().format("%Y%m%dT%H%M%S%.3fZ");
    let name = format!("{AUTOSAVE_PREFIX}{stamp}{AUTOSAVE_SUFFIX}");
    if !is_autosave_name(&name) {
        return Err(AppError::Internal("invalid autosave name generated".into()));
    }
    let dest = backups.join(&name);
    let pretty = serde_json::to_string_pretty(&doc)?;
    let tmp = backups.join(format!("{name}.tmp"));
    fs::write(&tmp, &pretty)?;
    fs::rename(&tmp, &dest)?;
    prune_autosaves(&backups)?;

    Ok(AutosaveWriteResult {
        path: dest.to_string_lossy().into_owned(),
        name,
    })
}

pub fn list_recovery(project_path: &Path) -> AppResult<Vec<AutosaveEntry>> {
    let backups = backups_dir(project_path);
    let entries = list_autosave_files(&backups)?;
    Ok(entries
        .into_iter()
        .map(|(path, meta)| AutosaveEntry {
            name: path
                .file_name()
                .map(|n| n.to_string_lossy().into_owned())
                .unwrap_or_default(),
            path: path.to_string_lossy().into_owned(),
            modified_ms: meta_to_ms(&meta),
            byte_size: meta.len(),
        })
        .collect())
}

/// Restore a named autosave over `project.json` after validating it.
pub fn restore_autosave(
    project_path: &Path,
    autosave_name: &str,
) -> AppResult<ProjectDocument> {
    let name = autosave_name.trim();
    if !is_autosave_name(name) {
        return Err(AppError::InvalidInput(
            "autosaveName must be a simple autosave-*.json filename".into(),
        ));
    }
    let src = backups_dir(project_path).join(name);
    if !src.is_file() {
        return Err(AppError::NotFound(format!("autosave not found: {name}")));
    }

    let backups = backups_dir(project_path);
    let src_canon = src
        .canonicalize()
        .map_err(|e| AppError::PathRejected(format!("autosave canonicalize failed: {e}")))?;
    let backups_canon = if backups.exists() {
        backups
            .canonicalize()
            .map_err(|e| AppError::PathRejected(format!("backups canonicalize failed: {e}")))?
    } else {
        return Err(AppError::NotFound("backups directory missing".into()));
    };
    if !src_canon.starts_with(&backups_canon) {
        return Err(AppError::PathRejected(
            "autosave path escapes backups directory".into(),
        ));
    }

    let raw = fs::read_to_string(&src_canon)?;
    let mut doc: ProjectDocument = serde_json::from_str(&raw).map_err(|e| {
        AppError::ProjectCorrupt(format!("autosave corrupt: {e}"))
    })?;
    validate_project_data(&doc)?;
    doc.last_recovered_at = Some(Utc::now());
    save_project(project_path, &doc)?;
    load_project(project_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::ProjectDocument;
    use tempfile::tempdir;

    #[test]
    fn autosave_write_list_restore_round_trip() {
        let dir = tempdir().unwrap();
        let bundle = dir.path().join("Recover.pvg");
        let mut doc = ProjectDocument::new("Recover", "ws-local");
        doc.description = "original".into();
        save_project(&bundle, &doc).unwrap();

        let written = write_autosave(&bundle, None).unwrap();
        assert!(written.name.starts_with("autosave-"));

        let list = list_recovery(&bundle).unwrap();
        assert_eq!(list.len(), 1);

        doc.description = "changed".into();
        save_project(&bundle, &doc).unwrap();

        let restored = restore_autosave(&bundle, &written.name).unwrap();
        assert_eq!(restored.description, "original");
        assert!(restored.last_recovered_at.is_some());
    }

    #[test]
    fn autosave_retention_bounded() {
        let dir = tempdir().unwrap();
        let bundle = dir.path().join("Retain.pvg");
        save_project(&bundle, &ProjectDocument::new("Retain", "ws-local")).unwrap();

        for _ in 0..7 {
            write_autosave(&bundle, None).unwrap();
            std::thread::sleep(std::time::Duration::from_millis(5));
        }

        let list = list_recovery(&bundle).unwrap();
        assert!(list.len() <= MAX_AUTOSAVES);
    }

    #[test]
    fn restore_rejects_path_escape_name() {
        let dir = tempdir().unwrap();
        let bundle = dir.path().join("Escape.pvg");
        save_project(&bundle, &ProjectDocument::new("Escape", "ws-local")).unwrap();

        let err = restore_autosave(&bundle, "../autosave-x.json").unwrap_err();
        assert!(matches!(err, AppError::InvalidInput(_)));
    }
}
