//! Proxy media generation — scaled copies under `proxies/`, never overwriting source.

use crate::error::{MediaError, MediaResult};
use crate::ffmpeg::{command_with_args, locate_ffmpeg, run_checked, ArgvBuilder};
use crate::path_safe::derivative_output_path;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

pub const PROXIES_DIR: &str = "proxies";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ScaleProfile {
    Half,
    Quarter,
    Eighth,
}

impl ScaleProfile {
    pub fn as_str(self) -> &'static str {
        match self {
            ScaleProfile::Half => "half",
            ScaleProfile::Quarter => "quarter",
            ScaleProfile::Eighth => "eighth",
        }
    }

    /// ffmpeg scale factor relative to source width/height.
    pub fn scale_expr(self) -> &'static str {
        match self {
            ScaleProfile::Half => "scale=iw/2:ih/2",
            ScaleProfile::Quarter => "scale=iw/4:ih/4",
            ScaleProfile::Eighth => "scale=iw/8:ih/8",
        }
    }
}

/// Generate a proxy under `{project_root}/proxies/{asset_id}_{profile}.mp4`.
/// Source path is never opened for write; output is always a separate file.
pub fn generate_proxy(
    project_root: &Path,
    source: &Path,
    asset_id: &str,
    profile: ScaleProfile,
) -> MediaResult<PathBuf> {
    // Hard guard: refuse if caller somehow passed an output that equals source.
    let file_name = format!("{asset_id}_{}.mp4", profile.as_str());
    let out = derivative_output_path(project_root, PROXIES_DIR, &file_name)?;

    if paths_equal(source, &out) {
        return Err(MediaError::InvalidInput(
            "refusing to overwrite source with proxy output".into(),
        ));
    }

    let ffmpeg = locate_ffmpeg()?;
    let argv = ArgvBuilder::new()
        .flag("-y")
        .flag("-i")
        .path(source)?
        .flag("-vf")
        .arg(profile.scale_expr())
        .flag("-c:v")
        .arg("libx264")
        .flag("-preset")
        .arg("veryfast")
        .flag("-crf")
        .arg("28")
        .flag("-c:a")
        .arg("aac")
        .flag("-b:a")
        .arg("96k")
        .flag("-movflags")
        .arg("+faststart")
        .path(&out)?
        .into_vec();

    let cmd = command_with_args(&ffmpeg, &argv)?;
    let output = run_checked(cmd)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // Retry without audio for video-only / image sources.
        if stderr.contains("Audio") || stderr.contains("audio") || stderr.contains("does not contain")
        {
            return generate_proxy_video_only(project_root, source, asset_id, profile, &out);
        }
        return Err(MediaError::FfmpegFailed(format!(
            "proxy encode failed: {stderr}"
        )));
    }

    if !out.is_file() {
        return Err(MediaError::FfmpegFailed(
            "proxy output missing after ffmpeg".into(),
        ));
    }
    Ok(out)
}

fn generate_proxy_video_only(
    _project_root: &Path,
    source: &Path,
    _asset_id: &str,
    profile: ScaleProfile,
    out: &Path,
) -> MediaResult<PathBuf> {
    let ffmpeg = locate_ffmpeg()?;
    let argv = ArgvBuilder::new()
        .flag("-y")
        .flag("-i")
        .path(source)?
        .flag("-vf")
        .arg(profile.scale_expr())
        .flag("-an")
        .flag("-c:v")
        .arg("libx264")
        .flag("-preset")
        .arg("veryfast")
        .flag("-crf")
        .arg("28")
        .flag("-movflags")
        .arg("+faststart")
        .path(out)?
        .into_vec();

    let cmd = command_with_args(&ffmpeg, &argv)?;
    let output = run_checked(cmd)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(MediaError::FfmpegFailed(format!(
            "proxy encode (video-only) failed: {stderr}"
        )));
    }
    Ok(out.to_path_buf())
}

fn paths_equal(a: &Path, b: &Path) -> bool {
    match (a.canonicalize(), b.canonicalize()) {
        (Ok(ca), Ok(cb)) => ca == cb,
        _ => a == b,
    }
}
