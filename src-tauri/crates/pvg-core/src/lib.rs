//! PVG native core — filesystem path security, project format, IPC input validation.
//! This crate intentionally has **no** Tauri/GTK dependencies so security and
//! serialization tests can run without installing WebKit system packages.

pub mod errors;
pub mod ipc_validation;
pub mod path_validation;
pub mod project;

pub use errors::{to_invoke_error, AppError, AppResult};
pub use ipc_validation::{require_nonempty, sanitize_project_name};
pub use path_validation::{
    assert_within_roots, canonicalize_checked, is_unc_or_device_path, reject_traversal_components,
    validate_path_under_roots, PathPolicy,
};
pub use project::{
    ensure_bundle_dirs, is_autosave_name, list_recovery, load_project, restore_autosave,
    save_project, validate_project_data, write_autosave, AudioMetadata, AutosaveEntry,
    AutosaveWriteResult, DerivativeRef, ImageMetadata, MediaBin, MediaLocation, ProjectAsset,
    ProjectBundleMeta, ProjectDocument, ProjectSettings, Sequence, VideoMetadata, BUNDLE_DIRS,
    CURRENT_PROJECT_SCHEMA_VERSION, MAX_AUTOSAVES,
};
