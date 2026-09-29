mod bridge;
mod model;
mod recovery;

pub use bridge::{
    ensure_bundle_dirs, load_project, save_project, validate_project_data, BUNDLE_DIRS,
};
pub use model::{
    AudioMetadata, DerivativeRef, ImageMetadata, MediaBin, MediaLocation, ProjectAsset,
    ProjectBundleMeta, ProjectDocument, ProjectSettings, Sequence, VideoMetadata,
    CURRENT_PROJECT_SCHEMA_VERSION,
};
pub use recovery::{
    is_autosave_name, list_recovery, restore_autosave, write_autosave, AutosaveEntry,
    AutosaveWriteResult, AUTOSAVE_PREFIX, MAX_AUTOSAVES,
};
