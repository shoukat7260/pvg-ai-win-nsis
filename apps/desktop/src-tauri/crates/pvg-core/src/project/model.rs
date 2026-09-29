use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use uuid::Uuid;

pub const CURRENT_PROJECT_SCHEMA_VERSION: u32 = 3;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDocument {
    pub schema_version: u32,
    pub id: Uuid,
    pub name: String,
    pub workspace_id: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_saved_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub app_version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub last_recovered_at: Option<DateTime<Utc>>,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub assets: Vec<ProjectAsset>,
    #[serde(default)]
    pub bins: Vec<MediaBin>,
    #[serde(default)]
    pub sequences: Vec<Sequence>,
    #[serde(default)]
    pub settings: ProjectSettings,
    /// Preserves unknown top-level keys (e.g. legacy `timeline`) on round-trip.
    #[serde(default, flatten)]
    pub extra: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "mode", rename_all = "camelCase")]
pub enum MediaLocation {
    Link {
        #[serde(rename = "absolutePath")]
        absolute_path: String,
    },
    Copy {
        #[serde(rename = "relativePath")]
        relative_path: String,
    },
}

impl MediaLocation {
    pub fn mode_str(&self) -> &'static str {
        match self {
            MediaLocation::Link { .. } => "link",
            MediaLocation::Copy { .. } => "copy",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct DerivativeRef {
    pub relative_path: String,
    pub engine_version: String,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub byte_size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadata {
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
    #[serde(default)]
    pub duration_ms: Option<f64>,
    #[serde(default)]
    pub frame_rate: Option<f64>,
    #[serde(default)]
    pub codec: Option<String>,
    #[serde(default)]
    pub container: Option<String>,
    #[serde(default)]
    pub pixel_format: Option<String>,
    #[serde(default)]
    pub bitrate: Option<u64>,
    #[serde(default)]
    pub rotation: Option<f64>,
    #[serde(default)]
    pub has_audio: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct AudioMetadata {
    #[serde(default)]
    pub duration_ms: Option<f64>,
    #[serde(default)]
    pub sample_rate: Option<u32>,
    #[serde(default)]
    pub channels: Option<u32>,
    #[serde(default)]
    pub codec: Option<String>,
    #[serde(default)]
    pub bitrate: Option<u64>,
    #[serde(default)]
    pub bit_depth: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub struct ImageMetadata {
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
    #[serde(default)]
    pub format: Option<String>,
    #[serde(default)]
    pub orientation: Option<i32>,
    #[serde(default)]
    pub has_alpha: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectAsset {
    pub id: Uuid,
    pub kind: String,
    pub name: String,
    /// Bundle-relative path (managed copy) or display stub for LINK.
    pub relative_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location: Option<MediaLocation>,
    #[serde(default)]
    pub mime_type: Option<String>,
    #[serde(default)]
    pub byte_size: Option<u64>,
    #[serde(default)]
    pub source_asset_id: Option<Uuid>,
    #[serde(default = "default_availability")]
    pub availability: String,
    #[serde(default)]
    pub fingerprint: Option<String>,
    #[serde(default)]
    pub video: Option<VideoMetadata>,
    #[serde(default)]
    pub audio: Option<AudioMetadata>,
    #[serde(default)]
    pub image: Option<ImageMetadata>,
    #[serde(default)]
    pub thumbnail: Option<DerivativeRef>,
    #[serde(default)]
    pub waveform: Option<DerivativeRef>,
    #[serde(default)]
    pub proxy: Option<DerivativeRef>,
    #[serde(default)]
    pub bin_id: Option<Uuid>,
    #[serde(default)]
    pub favorite: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    #[serde(default, flatten)]
    pub extra: Map<String, Value>,
}

fn default_availability() -> String {
    "available".into()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct MediaBin {
    pub id: Uuid,
    pub name: String,
    #[serde(default)]
    pub parent_id: Option<Uuid>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Sequence {
    pub id: Uuid,
    pub name: String,
    #[serde(default)]
    pub duration_ms: f64,
    #[serde(default = "default_frame_rate")]
    pub frame_rate: f64,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
    #[serde(default)]
    pub tracks: Vec<Value>,
    #[serde(default, flatten)]
    pub extra: Map<String, Value>,
}

fn default_frame_rate() -> f64 {
    30.0
}
fn default_width() -> u32 {
    1920
}
fn default_height() -> u32 {
    1080
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSettings {
    #[serde(default = "default_frame_rate")]
    pub frame_rate: f64,
    #[serde(default = "default_width")]
    pub width: u32,
    #[serde(default = "default_height")]
    pub height: u32,
    #[serde(default = "default_sample_rate")]
    pub sample_rate: u32,
    #[serde(default = "default_locale")]
    pub locale: String,
    #[serde(default = "default_preview_quality")]
    pub preview_quality: String,
    #[serde(default = "default_proxy_mode")]
    pub proxy_mode: String,
    #[serde(default = "default_background")]
    pub default_background: String,
    #[serde(default, flatten)]
    pub extra: Map<String, Value>,
}

fn default_sample_rate() -> u32 {
    48_000
}
fn default_locale() -> String {
    "en-US".into()
}
fn default_preview_quality() -> String {
    "balanced".into()
}
fn default_proxy_mode() -> String {
    "auto".into()
}
fn default_background() -> String {
    "#000000".into()
}

impl Default for ProjectSettings {
    fn default() -> Self {
        Self {
            frame_rate: default_frame_rate(),
            width: default_width(),
            height: default_height(),
            sample_rate: default_sample_rate(),
            locale: default_locale(),
            preview_quality: default_preview_quality(),
            proxy_mode: default_proxy_mode(),
            default_background: default_background(),
            extra: Map::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBundleMeta {
    pub id: Uuid,
    pub name: String,
    pub path: String,
    pub workspace_id: String,
    pub schema_version: u32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub description: String,
}

impl ProjectDocument {
    pub fn new(name: impl Into<String>, workspace_id: impl Into<String>) -> Self {
        let now = Utc::now();
        let settings = ProjectSettings::default();
        Self {
            schema_version: CURRENT_PROJECT_SCHEMA_VERSION,
            id: Uuid::new_v4(),
            name: name.into(),
            workspace_id: workspace_id.into(),
            created_at: now,
            updated_at: now,
            last_saved_at: None,
            app_version: None,
            last_recovered_at: None,
            description: String::new(),
            tags: Vec::new(),
            assets: Vec::new(),
            bins: Vec::new(),
            sequences: vec![Sequence {
                id: Uuid::new_v4(),
                name: "Sequence 1".into(),
                duration_ms: 0.0,
                frame_rate: settings.frame_rate,
                width: settings.width,
                height: settings.height,
                tracks: Vec::new(),
                extra: Map::new(),
            }],
            settings,
            extra: Map::new(),
        }
    }

    pub fn to_meta(&self, path: impl Into<String>) -> ProjectBundleMeta {
        ProjectBundleMeta {
            id: self.id,
            name: self.name.clone(),
            path: path.into(),
            workspace_id: self.workspace_id.clone(),
            schema_version: self.schema_version,
            created_at: self.created_at,
            updated_at: self.updated_at,
            description: self.description.clone(),
        }
    }

    pub fn find_asset_mut(&mut self, asset_id: &Uuid) -> Option<&mut ProjectAsset> {
        self.assets.iter_mut().find(|a| &a.id == asset_id)
    }

    pub fn find_asset(&self, asset_id: &Uuid) -> Option<&ProjectAsset> {
        self.assets.iter().find(|a| &a.id == asset_id)
    }
}
