use super::model::{ProjectDocument, CURRENT_PROJECT_SCHEMA_VERSION};
use crate::errors::{AppError, AppResult};
use std::fs;
use std::path::Path;

const PROJECT_FILE: &str = "project.json";

/// Bundle subdirectories created for every new / saved project.
pub const BUNDLE_DIRS: &[&str] = &[
    "assets",
    "proxies",
    "generated",
    "audio",
    "captions",
    "thumbnails",
    "renders",
    "backups",
    "cache",
    "media",
    "media/imported",
    "media/originals",
    "waveforms",
];

pub fn validate_project_data(doc: &ProjectDocument) -> AppResult<()> {
    if doc.schema_version == 0 {
        return Err(AppError::UnsupportedSchemaVersion(
            "schema_version must be >= 1".into(),
        ));
    }
    if doc.schema_version > CURRENT_PROJECT_SCHEMA_VERSION {
        return Err(AppError::UnsupportedSchemaVersion(format!(
            "got {}, supported {}",
            doc.schema_version, CURRENT_PROJECT_SCHEMA_VERSION
        )));
    }
    let name = doc.name.trim();
    if name.is_empty() {
        return Err(AppError::ProjectInvalid("name is required".into()));
    }
    if name.len() > 120 {
        return Err(AppError::ProjectInvalid(
            "name exceeds 120 characters".into(),
        ));
    }
    if doc.workspace_id.trim().is_empty() {
        return Err(AppError::ProjectInvalid(
            "workspace_id is required".into(),
        ));
    }
    if doc.name.contains('/') || doc.name.contains('\\') || doc.name.contains("..") {
        return Err(AppError::ProjectInvalid(
            "name must not contain path separators or traversal".into(),
        ));
    }
    Ok(())
}

pub fn ensure_bundle_dirs(bundle_path: &Path) -> AppResult<()> {
    fs::create_dir_all(bundle_path)?;
    for sub in BUNDLE_DIRS {
        fs::create_dir_all(bundle_path.join(sub))?;
    }
    Ok(())
}

pub fn load_project(bundle_path: &Path) -> AppResult<ProjectDocument> {
    let file = bundle_path.join(PROJECT_FILE);
    if !file.exists() {
        return Err(AppError::NotFound(format!(
            "missing {PROJECT_FILE} in {}",
            bundle_path.display()
        )));
    }
    let raw = fs::read_to_string(&file)?;
    let doc: ProjectDocument = serde_json::from_str(&raw).map_err(|e| {
        AppError::ProjectCorrupt(format!("failed to parse {PROJECT_FILE}: {e}"))
    })?;
    validate_project_data(&doc)?;
    Ok(doc)
}

pub fn save_project(bundle_path: &Path, doc: &ProjectDocument) -> AppResult<()> {
    validate_project_data(doc)?;
    ensure_bundle_dirs(bundle_path)?;
    let file = bundle_path.join(PROJECT_FILE);
    let mut to_write = doc.clone();
    to_write.updated_at = chrono::Utc::now();
    let pretty = serde_json::to_string_pretty(&to_write)?;
    fs::write(file, pretty)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::project::model::{MediaLocation, ProjectAsset, ProjectSettings};
    use chrono::Utc;
    use serde_json::json;
    use tempfile::tempdir;
    use uuid::Uuid;

    fn sample() -> ProjectDocument {
        ProjectDocument::new("Demo", "ws-local")
    }

    #[test]
    fn round_trips_project_json() {
        let dir = tempdir().unwrap();
        let bundle = dir.path().join("Demo.pvg");
        let doc = sample();
        save_project(&bundle, &doc).unwrap();
        let loaded = load_project(&bundle).unwrap();
        assert_eq!(loaded.id, doc.id);
        assert_eq!(loaded.name, "Demo");
        assert_eq!(loaded.schema_version, CURRENT_PROJECT_SCHEMA_VERSION);
        assert!(bundle.join("assets").is_dir());
        assert!(bundle.join("media/imported").is_dir());
        assert!(bundle.join("media/originals").is_dir());
        assert!(bundle.join("waveforms").is_dir());
    }

    #[test]
    fn new_project_is_schema_v3_with_defaults() {
        let doc = sample();
        assert_eq!(doc.schema_version, 3);
        assert!(doc.assets.is_empty());
        assert!(doc.bins.is_empty());
        assert_eq!(doc.sequences.len(), 1);
        assert_eq!(doc.sequences[0].name, "Sequence 1");
        assert_eq!(doc.settings.frame_rate, 30.0);
        assert_eq!(doc.settings.proxy_mode, "auto");
    }

    #[test]
    fn preserves_assets_sequences_settings_round_trip() {
        let dir = tempdir().unwrap();
        let bundle = dir.path().join("Full.pvg");
        let mut doc = sample();
        let asset_id = Uuid::new_v4();
        let now = Utc::now();
        doc.assets.push(ProjectAsset {
            id: asset_id,
            kind: "video".into(),
            name: "clip.mp4".into(),
            relative_path: "media/imported/x/clip.mp4".into(),
            location: Some(MediaLocation::Copy {
                relative_path: "media/imported/x/clip.mp4".into(),
            }),
            mime_type: Some("video/mp4".into()),
            byte_size: Some(1024),
            source_asset_id: None,
            availability: "available".into(),
            fingerprint: Some("abc".into()),
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
        });
        doc.settings = ProjectSettings {
            frame_rate: 24.0,
            width: 1280,
            height: 720,
            ..ProjectSettings::default()
        };
        doc.extra.insert("timeline".into(), json!({"version": 1, "tracks": []}));

        save_project(&bundle, &doc).unwrap();
        let loaded = load_project(&bundle).unwrap();
        assert_eq!(loaded.assets.len(), 1);
        assert_eq!(loaded.assets[0].id, asset_id);
        assert_eq!(loaded.assets[0].name, "clip.mp4");
        assert!(matches!(
            loaded.assets[0].location,
            Some(MediaLocation::Copy { .. })
        ));
        assert_eq!(loaded.settings.frame_rate, 24.0);
        assert_eq!(loaded.settings.width, 1280);
        assert_eq!(loaded.extra.get("timeline").unwrap()["version"], 1);
        assert_eq!(loaded.sequences.len(), 1);
    }

    #[test]
    fn preserves_link_location_absolute_path() {
        let dir = tempdir().unwrap();
        let bundle = dir.path().join("Link.pvg");
        let mut doc = sample();
        let now = Utc::now();
        doc.assets.push(ProjectAsset {
            id: Uuid::new_v4(),
            kind: "video".into(),
            name: "ext.mp4".into(),
            relative_path: "media/linked/ext.mp4".into(),
            location: Some(MediaLocation::Link {
                absolute_path: "/home/user/Videos/ext.mp4".into(),
            }),
            mime_type: None,
            byte_size: None,
            source_asset_id: None,
            availability: "available".into(),
            fingerprint: None,
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
        });
        save_project(&bundle, &doc).unwrap();
        let raw = fs::read_to_string(bundle.join(PROJECT_FILE)).unwrap();
        let v: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(v["assets"][0]["location"]["mode"], "link");
        assert_eq!(
            v["assets"][0]["location"]["absolutePath"],
            "/home/user/Videos/ext.mp4"
        );
        let loaded = load_project(&bundle).unwrap();
        match &loaded.assets[0].location {
            Some(MediaLocation::Link { absolute_path }) => {
                assert_eq!(absolute_path, "/home/user/Videos/ext.mp4");
            }
            other => panic!("expected link location, got {other:?}"),
        }
    }

    #[test]
    fn rejects_empty_name() {
        let mut doc = sample();
        doc.name = "   ".into();
        let err = validate_project_data(&doc).unwrap_err();
        assert!(matches!(err, AppError::ProjectInvalid(_)));
    }

    #[test]
    fn rejects_path_like_name() {
        let mut doc = sample();
        doc.name = "../escape".into();
        assert!(validate_project_data(&doc).is_err());
    }

    #[test]
    fn rejects_future_schema() {
        let mut doc = sample();
        doc.schema_version = 99;
        let err = validate_project_data(&doc).unwrap_err();
        assert!(matches!(err, AppError::UnsupportedSchemaVersion(_)));
    }

    #[test]
    fn rejects_corrupt_json() {
        let dir = tempdir().unwrap();
        let bundle = dir.path().join("Bad.pvg");
        fs::create_dir_all(&bundle).unwrap();
        fs::write(bundle.join(PROJECT_FILE), "{not-json").unwrap();
        let err = load_project(&bundle).unwrap_err();
        assert!(matches!(err, AppError::ProjectCorrupt(_)));
    }

    #[test]
    fn serialization_includes_id() {
        let doc = sample();
        let json = serde_json::to_value(&doc).unwrap();
        assert!(json.get("id").is_some());
        assert_eq!(json["schemaVersion"], CURRENT_PROJECT_SCHEMA_VERSION);
        let _id: Uuid = serde_json::from_value(json["id"].clone()).unwrap();
        assert!(json["assets"].is_array());
        assert!(json["bins"].is_array());
        assert!(json["sequences"].is_array());
        assert!(json["settings"].is_object());
    }

    #[test]
    fn meta_extraction_still_works() {
        let doc = sample();
        let meta = doc.to_meta("/tmp/Demo.pvg");
        assert_eq!(meta.id, doc.id);
        assert_eq!(meta.name, "Demo");
        assert_eq!(meta.workspace_id, "ws-local");
        assert_eq!(meta.schema_version, 3);
        assert_eq!(meta.path, "/tmp/Demo.pvg");
    }
}
