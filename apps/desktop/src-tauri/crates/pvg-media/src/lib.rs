//! PVG media engine — probe, derivatives (thumbnails/waveforms/proxies), fingerprints, jobs.
//!
//! FFmpeg/ffprobe are invoked exclusively via `std::process::Command` argument arrays.
//! This crate has **no** Tauri dependency; IPC wiring lives in `pvg-desktop`.

pub mod error;
pub mod export;
pub mod ffmpeg;
pub mod fingerprint;
pub mod jobs;
pub mod path_safe;
pub mod probe;
pub mod project_assets;
pub mod proxy;
pub mod thumbnail;
pub mod waveform;

pub use error::{MediaError, MediaResult};
pub use export::{export_sequence_mp4, ExportPreset, ExportResult, RENDERS_DIR};
pub use ffmpeg::{
    command_with_args, locate_ffmpeg, locate_ffprobe, run_checked, validate_arg_path, ArgvBuilder,
};
pub use fingerprint::{fingerprint_bytes, fingerprint_file, MediaFingerprint, FINGERPRINT_HEAD_BYTES};
pub use jobs::{
    JobHandle, JobManager, JobProgress, JobSnapshot, JobStage, JobState, JobType, JobWork,
};
pub use path_safe::{
    derivative_output_path, ensure_derivative_dir, safe_join_under_project, validate_under_project,
};
pub use probe::{probe_media, ProbeResult};
pub use project_assets::{
    import_asset, relink_asset, remove_asset, resolve_asset_source, validate_import_source,
    ImportMode,
};
pub use proxy::{generate_proxy, ScaleProfile, PROXIES_DIR};
pub use thumbnail::{generate_thumbnail, ThumbnailOptions, THUMBNAILS_DIR};
pub use waveform::{
    generate_waveform, peaks_from_pcm, WaveformPeaks, DEFAULT_PEAK_BINS, WAVEFORMS_DIR,
};
