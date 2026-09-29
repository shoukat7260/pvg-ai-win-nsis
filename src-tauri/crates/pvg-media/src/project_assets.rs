//! Project-scoped media asset operations (import / remove / relink).
//!
//! Lives in `pvg-media` (no Tauri) so path-safety tests run without GTK.
//!
//! **Import sources may live outside the workspace** (LINK). Project bundle
//! paths and derivative outputs must still stay under the project root.

use crate::error::{MediaError, MediaResult};
use crate::fingerprint::fingerprint_file;
use crate::path_safe::validate_under_project;
use chrono::Utc;
use pvg_core::{
    canonicalize_checked, is_unc_or_device_path, load_project, reject_traversal_components,
    save_project, MediaLocation, ProjectAsset, ProjectDocument,
};
use std::fs;
use std::path::{Component, Path, PathBuf};
use uuid::Uuid;

/// Validate a user-selected import/relink source file.
///
/// Allows absolute paths outside the workspace (LINK). Rejects `..` segments,
/// UNC/device paths, directories, and missing files.
pub fn validate_import_source(path: &Path) -> MediaResult<PathBuf> {
    if path.as_os_str().is_empty() {
        return Err(MediaError::InvalidInput("sourcePath is required".into()));
    }
    if is_unc_or_device_path(path) {
        return Err(MediaError::PathRejected(
            "UNC / device paths are not allowed as import sources".into(),
        ));
    }
    reject_traversal_components(path).map_err(MediaError::from)?;

    if !path.is_absolute() {
        if path.components().any(|c| matches!(c, Component::ParentDir)) {
            return Err(MediaError::PathRejected(
                "parent directory segments (..) are not allowed".into(),
            ));
        }
        return Err(MediaError::InvalidInput(
            "import sourcePath must be an absolute file path".into(),
        ));
    }

    let canon = canonicalize_checked(path).map_err(MediaError::from)?;
    if !canon.is_file() {
        return Err(MediaError::InvalidInput(format!(
            "import source must be an existing file: {}",
            canon.display()
        )));
    }
    Ok(canon)
}

fn safe_file_stem(path: &Path) -> String {
    path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("media")
        .chars()
        .map(|c| match c {
            '/' | '\\' | '\0' => '_',
            c => c,
        })
        .collect()
}

fn guess_kind(path: &Path) -> String {
    let ext = path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp" | "tif" | "tiff" => "image".into(),
        "mp3" | "wav" | "flac" | "aac" | "m4a" | "ogg" | "opus" => "audio".into(),
        "mp4" | "mov" | "mkv" | "webm" | "avi" | "m4v" => "video".into(),
        "srt" | "vtt" | "ass" => "caption".into(),
        _ => "other".into(),
    }
}

/// Resolve the on-disk source path for an asset (LINK absolute or COPY relative).
pub fn resolve_asset_source(project: &Path, asset: &ProjectAsset) -> MediaResult<PathBuf> {
    match &asset.location {
        Some(MediaLocation::Link { absolute_path }) => {
            validate_import_source(Path::new(absolute_path))
        }
        Some(MediaLocation::Copy { relative_path }) => {
            let joined = project.join(relative_path);
            validate_under_project(project, &joined)
        }
        None => {
            let joined = project.join(&asset.relative_path);
            validate_under_project(project, &joined)
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ImportMode {
    Link,
    Copy,
}

impl ImportMode {
    pub fn parse(s: &str) -> MediaResult<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "link" => Ok(ImportMode::Link),
            "copy" => Ok(ImportMode::Copy),
            _ => Err(MediaError::InvalidInput(
                "mode must be \"link\" or \"copy\"".into(),
            )),
        }
    }
}

/// Create an asset record in `project.json`, optionally copying bytes under `media/imported/`.
pub fn import_asset(
    project_path: &Path,
    source_path: &Path,
    mode: ImportMode,
    name: Option<&str>,
) -> MediaResult<ProjectAsset> {
    let source = validate_import_source(source_path)?;
    let mut doc = load_project(project_path).map_err(MediaError::from)?;
    let asset_id = Uuid::new_v4();
    let file_name = safe_file_stem(&source);
    let display_name = name
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or(&file_name)
        .to_string();

    let fp = fingerprint_file(&source).ok();
    let byte_size = fp
        .as_ref()
        .map(|f| f.size_bytes)
        .or_else(|| fs::metadata(&source).ok().map(|m| m.len()));
    let fingerprint = fp.map(|f| f.id);

    let now = Utc::now();
    let (relative_path, location) = match mode {
        ImportMode::Copy => {
            let rel = format!("media/imported/{asset_id}/{file_name}");
            let dest = project_path.join(&rel);
            if let Some(parent) = dest.parent() {
                validate_under_project(project_path, parent)?;
                fs::create_dir_all(parent)?;
            }
            let dest = validate_under_project(project_path, &dest)?;
            fs::copy(&source, &dest)?;
            (
                rel.clone(),
                Some(MediaLocation::Copy {
                    relative_path: rel,
                }),
            )
        }
        ImportMode::Link => {
            let rel = format!("media/linked/{asset_id}/{file_name}");
            (
                rel,
                Some(MediaLocation::Link {
                    absolute_path: source.to_string_lossy().into_owned(),
                }),
            )
        }
    };

    let asset = ProjectAsset {
        id: asset_id,
        kind: guess_kind(&source),
        name: display_name,
        relative_path,
        location,
        mime_type: None,
        byte_size,
        source_asset_id: None,
        availability: "available".into(),
        fingerprint,
        video: None,
        audio: None,
        image: None,
        thumbnail: None,
        waveform: None,
        proxy: None,
        bin_id: None,
        favorite: false,
        created_at: now,
        updated_at: now,
        extra: Default::default(),
    };

    doc.assets.push(asset.clone());
    save_project(project_path, &doc).map_err(MediaError::from)?;
    Ok(asset)
}

/// Remove an asset from the project.
///
/// **Never** deletes LINK source files. Managed COPY bytes are deleted only when
/// `delete_managed_copy` is true. Derivative files under the bundle are cleaned
/// best-effort.
pub fn remove_asset(
    project_path: &Path,
    asset_id: Uuid,
    delete_managed_copy: bool,
) -> MediaResult<ProjectDocument> {
    let mut doc = load_project(project_path).map_err(MediaError::from)?;
    let idx = doc
        .assets
        .iter()
        .position(|a| a.id == asset_id)
        .ok_or_else(|| MediaError::InvalidInput(format!("asset not found: {asset_id}")))?;
    let asset = doc.assets.remove(idx);

    if delete_managed_copy {
        if let Some(MediaLocation::Copy { relative_path }) = &asset.location {
            let managed = project_path.join(relative_path);
            if let Ok(validated) = validate_under_project(project_path, &managed) {
                if validated.is_file() {
                    let _ = fs::remove_file(&validated);
                }
                if let Some(parent) = validated.parent() {
                    if parent.starts_with(project_path.join("media/imported")) {
                        let _ = fs::remove_dir(parent);
                    }
                }
            }
        }
    }

    for rel in [
        asset.thumbnail.as_ref().map(|d| d.relative_path.as_str()),
        asset.waveform.as_ref().map(|d| d.relative_path.as_str()),
        asset.proxy.as_ref().map(|d| d.relative_path.as_str()),
    ]
    .into_iter()
    .flatten()
    {
        let candidate = project_path.join(rel);
        if let Ok(validated) = validate_under_project(project_path, &candidate) {
            let _ = fs::remove_file(validated);
        }
    }

    save_project(project_path, &doc).map_err(MediaError::from)?;
    Ok(doc)
}

/// Relink a LINK (or any) asset to a new absolute source path.
pub fn relink_asset(
    project_path: &Path,
    asset_id: Uuid,
    new_source_path: &Path,
) -> MediaResult<ProjectAsset> {
    let new_source = validate_import_source(new_source_path)?;
    let mut doc = load_project(project_path).map_err(MediaError::from)?;
    let asset = doc
        .find_asset_mut(&asset_id)
        .ok_or_else(|| MediaError::InvalidInput(format!("asset not found: {asset_id}")))?;

    let fp = fingerprint_file(&new_source).ok();
    asset.location = Some(MediaLocation::Link {
        absolute_path: new_source.to_string_lossy().into_owned(),
    });
    asset.fingerprint = fp.as_ref().map(|f| f.id.clone());
    asset.byte_size = fp.map(|f| f.size_bytes);
    asset.availability = "available".into();
    asset.updated_at = Utc::now();
    let result = asset.clone();
    save_project(project_path, &doc).map_err(MediaError::from)?;
    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;
    use pvg_core::ProjectDocument;
    use std::io::Write;
    use tempfile::tempdir;

    fn bundle_with_project(root: &Path) -> PathBuf {
        let bundle = root.join("Test.pvg");
        let doc = ProjectDocument::new("Test", "ws-local");
        save_project(&bundle, &doc).unwrap();
        bundle
    }

    #[test]
    fn import_refuses_relative_path_with_dotdot() {
        let dir = tempdir().unwrap();
        let bundle = bundle_with_project(dir.path());
        let err = import_asset(
            &bundle,
            Path::new("../etc/passwd"),
            ImportMode::Link,
            None,
        )
        .unwrap_err();
        assert!(
            matches!(err, MediaError::PathRejected(_) | MediaError::InvalidInput(_)),
            "got {err:?}"
        );
    }

    #[test]
    fn import_refuses_absolute_path_with_dotdot_segments() {
        let err = validate_import_source(Path::new("/tmp/foo/../bar.mp4")).unwrap_err();
        assert!(matches!(err, MediaError::PathRejected(_)));
    }

    #[test]
    fn remove_asset_does_not_delete_linked_source() {
        let dir = tempdir().unwrap();
        let bundle = bundle_with_project(dir.path());

        let source_dir = dir.path().join("outside");
        fs::create_dir_all(&source_dir).unwrap();
        let source = source_dir.join("keep-me.bin");
        {
            let mut f = fs::File::create(&source).unwrap();
            f.write_all(b"linked-bytes").unwrap();
        }

        let asset = import_asset(&bundle, &source, ImportMode::Link, Some("keep")).unwrap();
        assert!(source.is_file());

        remove_asset(&bundle, asset.id, true).unwrap();

        assert!(
            source.is_file(),
            "LINK source must not be deleted even when delete_managed_copy=true"
        );
        assert_eq!(fs::read_to_string(&source).unwrap(), "linked-bytes");
    }

    #[test]
    fn copy_import_remove_deletes_managed_not_source() {
        let dir = tempdir().unwrap();
        let bundle = bundle_with_project(dir.path());
        let source = dir.path().join("clip.bin");
        fs::write(&source, b"copy-me").unwrap();

        let asset = import_asset(&bundle, &source, ImportMode::Copy, None).unwrap();
        let managed = bundle.join(&asset.relative_path);
        assert!(managed.is_file());

        remove_asset(&bundle, asset.id, true).unwrap();
        assert!(!managed.exists());
        assert!(source.is_file());
    }

    #[test]
    fn derivative_path_escape_still_rejected() {
        let dir = tempdir().unwrap();
        let root = dir.path().join("project");
        fs::create_dir_all(&root).unwrap();
        let err = crate::path_safe::derivative_output_path(&root, "thumbnails", "../evil.jpg")
            .unwrap_err();
        assert!(matches!(err, MediaError::PathRejected(_)));
    }

    #[test]
    fn malicious_filename_remains_single_argv() {
        use crate::ffmpeg::ArgvBuilder;
        use std::ffi::OsString;
        let evil = Path::new("video; rm -rf.mp4");
        let argv = ArgvBuilder::new()
            .flag("-i")
            .path(evil)
            .unwrap()
            .into_vec();
        assert_eq!(argv[1], OsString::from("video; rm -rf.mp4"));
        assert!(!argv.iter().any(|a| a == "rm"));
    }
}
