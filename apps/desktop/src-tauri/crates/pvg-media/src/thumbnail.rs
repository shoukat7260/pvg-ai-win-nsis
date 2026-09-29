//! JPEG thumbnail generation via ffmpeg argv (no shell).

use crate::error::{MediaError, MediaResult};
use crate::ffmpeg::{command_with_args, locate_ffmpeg, run_checked, ArgvBuilder};
use crate::path_safe::derivative_output_path;
use crate::probe::{probe_media, ProbeResult};
use std::path::{Path, PathBuf};

pub const THUMBNAILS_DIR: &str = "thumbnails";

#[derive(Debug, Clone)]
pub struct ThumbnailOptions {
    pub max_width: u32,
    pub quality: u8,
}

impl Default for ThumbnailOptions {
    fn default() -> Self {
        Self {
            max_width: 480,
            quality: 4, // ffmpeg -q:v scale (2-5 typical for JPEG)
        }
    }
}

fn seek_secs_for_video(probe: &ProbeResult) -> f64 {
    match probe.duration_secs {
        Some(d) if d.is_finite() && d > 0.0 => (d * 0.10).clamp(0.0, d.max(0.0)),
        _ => 1.0,
    }
}

fn run_ffmpeg(argv: ArgvBuilder) -> MediaResult<()> {
    let ffmpeg = locate_ffmpeg()?;
    let args = argv.into_vec();
    let cmd = command_with_args(&ffmpeg, &args)?;
    let output = run_checked(cmd)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(MediaError::FfmpegFailed(format!(
            "ffmpeg thumbnail failed: {stderr}"
        )));
    }
    Ok(())
}

/// Generate a JPEG thumbnail under `{project_root}/thumbnails/{asset_id}.jpg`.
/// For video, seeks to ~10% of duration (not frame 0). For images, scales/copies via ffmpeg.
pub fn generate_thumbnail(
    project_root: &Path,
    source: &Path,
    asset_id: &str,
    options: &ThumbnailOptions,
) -> MediaResult<PathBuf> {
    let file_name = format!("{asset_id}.jpg");
    let out = derivative_output_path(project_root, THUMBNAILS_DIR, &file_name)?;

    let probe = match probe_media(source) {
        Ok(p) => p,
        Err(MediaError::EngineUnavailable(msg)) => {
            return Err(MediaError::EngineUnavailable(msg));
        }
        Err(_) => ProbeResult {
            width: None,
            height: None,
            duration_secs: None,
            fps: None,
            video_codec: None,
            audio_codec: None,
            container: None,
            has_video: true,
            has_audio: false,
            is_image: false,
        },
    };

    let scale = format!("scale='min({}\\,iw)':-2", options.max_width);
    let q = options.quality.clamp(2, 31).to_string();

    if probe.is_image || (!probe.has_video && !probe.has_audio) {
        // Still image: decode + scale to JPEG (copy/resize path).
        let argv = ArgvBuilder::new()
            .flag("-y")
            .flag("-i")
            .path(source)?
            .flag("-vf")
            .arg(&scale)
            .flag("-frames:v")
            .arg("1")
            .flag("-q:v")
            .arg(&q)
            .path(&out)?;
        run_ffmpeg(argv)?;
    } else {
        let seek = format!("{:.3}", seek_secs_for_video(&probe));
        // -ss after -i is accurate; prefer mid-clip sample rather than frame 0.
        let argv = ArgvBuilder::new()
            .flag("-y")
            .flag("-i")
            .path(source)?
            .flag("-ss")
            .arg(&seek)
            .flag("-vf")
            .arg(&scale)
            .flag("-frames:v")
            .arg("1")
            .flag("-q:v")
            .arg(&q)
            .path(&out)?;
        run_ffmpeg(argv)?;
    }

    if !out.is_file() {
        return Err(MediaError::FfmpegFailed(
            "thumbnail output missing after ffmpeg".into(),
        ));
    }
    Ok(out)
}
