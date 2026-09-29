//! Media probe via ffprobe JSON output.

use crate::error::{MediaError, MediaResult};
use crate::ffmpeg::{command_with_args, locate_ffprobe, run_checked, ArgvBuilder};
use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProbeResult {
    pub width: Option<u32>,
    pub height: Option<u32>,
    /// Duration in seconds when known.
    pub duration_secs: Option<f64>,
    pub fps: Option<f64>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub container: Option<String>,
    pub has_video: bool,
    pub has_audio: bool,
    pub is_image: bool,
}

#[derive(Debug, Deserialize)]
struct FfprobeJson {
    format: Option<FfprobeFormat>,
    streams: Option<Vec<FfprobeStream>>,
}

#[derive(Debug, Deserialize)]
struct FfprobeFormat {
    format_name: Option<String>,
    duration: Option<String>,
}

#[derive(Debug, Deserialize)]
struct FfprobeStream {
    codec_type: Option<String>,
    codec_name: Option<String>,
    width: Option<u32>,
    height: Option<u32>,
    avg_frame_rate: Option<String>,
    r_frame_rate: Option<String>,
    duration: Option<String>,
}

fn parse_rate(rate: &str) -> Option<f64> {
    if rate.is_empty() || rate == "0/0" {
        return None;
    }
    if let Some((n, d)) = rate.split_once('/') {
        let num: f64 = n.parse().ok()?;
        let den: f64 = d.parse().ok()?;
        if den == 0.0 {
            return None;
        }
        Some(num / den)
    } else {
        rate.parse().ok()
    }
}

fn parse_duration(s: &str) -> Option<f64> {
    let v: f64 = s.parse().ok()?;
    if v.is_finite() && v >= 0.0 {
        Some(v)
    } else {
        None
    }
}

fn is_image_container(format_name: Option<&str>, has_video: bool, duration: Option<f64>) -> bool {
    let name = format_name.unwrap_or("").to_ascii_lowercase();
    let image_hints = ["image2", "png_pipe", "jpeg_pipe", "gif", "webp", "bmp_pipe", "tiff"];
    if image_hints.iter().any(|h| name.contains(h)) {
        return true;
    }
    // Single-frame "video" with negligible/no duration often means still image.
    has_video && duration.map(|d| d < 0.05).unwrap_or(false) && !name.contains("mp4")
}

/// Probe media metadata with ffprobe. Returns [`MediaError::EngineUnavailable`] when
/// ffprobe cannot be located or spawned (safe for CI without ffmpeg installed).
pub fn probe_media(path: &Path) -> MediaResult<ProbeResult> {
    let ffprobe = locate_ffprobe()?;
    let argv = ArgvBuilder::new()
        .flag("-v")
        .arg("quiet")
        .flag("-print_format")
        .arg("json")
        .flag("-show_format")
        .flag("-show_streams")
        .path(path)?
        .into_vec();

    let cmd = command_with_args(&ffprobe, &argv)?;
    let output = run_checked(cmd)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(MediaError::ProbeFailed(format!(
            "ffprobe exited {}: {stderr}",
            output.status
        )));
    }

    let parsed: FfprobeJson = serde_json::from_slice(&output.stdout).map_err(|e| {
        MediaError::ProbeFailed(format!("invalid ffprobe json: {e}"))
    })?;

    let streams = parsed.streams.unwrap_or_default();
    let mut width = None;
    let mut height = None;
    let mut fps = None;
    let mut video_codec = None;
    let mut audio_codec = None;
    let mut stream_duration = None;
    let mut has_video = false;
    let mut has_audio = false;

    for stream in &streams {
        match stream.codec_type.as_deref() {
            Some("video") => {
                has_video = true;
                if width.is_none() {
                    width = stream.width;
                    height = stream.height;
                    video_codec = stream.codec_name.clone();
                    fps = stream
                        .avg_frame_rate
                        .as_deref()
                        .and_then(parse_rate)
                        .or_else(|| stream.r_frame_rate.as_deref().and_then(parse_rate));
                    stream_duration = stream.duration.as_deref().and_then(parse_duration);
                }
            }
            Some("audio") => {
                has_audio = true;
                if audio_codec.is_none() {
                    audio_codec = stream.codec_name.clone();
                }
            }
            _ => {}
        }
    }

    let format_duration = parsed
        .format
        .as_ref()
        .and_then(|f| f.duration.as_deref())
        .and_then(parse_duration);
    let duration_secs = format_duration.or(stream_duration);
    let container = parsed
        .format
        .as_ref()
        .and_then(|f| f.format_name.clone());
    let is_image = is_image_container(container.as_deref(), has_video, duration_secs);

    Ok(ProbeResult {
        width,
        height,
        duration_secs,
        fps,
        video_codec,
        audio_codec,
        container,
        has_video,
        has_audio,
        is_image,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    // Serialize env mutations across tests in this crate.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn probe_returns_engine_unavailable_when_ffprobe_missing() {
        let _guard = ENV_LOCK.lock().unwrap();
        let prev = std::env::var_os("PVG_FFPROBE_PATH");
        let prev_path = std::env::var_os("PATH");

        std::env::set_var("PVG_FFPROBE_PATH", "/nonexistent/pvg-ffprobe-missing");
        std::env::set_var("PATH", "");

        let result = probe_media(Path::new("any.mp4"));
        assert!(
            matches!(result, Err(MediaError::EngineUnavailable(_))),
            "expected EngineUnavailable, got {result:?}"
        );

        match prev {
            Some(v) => std::env::set_var("PVG_FFPROBE_PATH", v),
            None => std::env::remove_var("PVG_FFPROBE_PATH"),
        }
        match prev_path {
            Some(v) => std::env::set_var("PATH", v),
            None => std::env::remove_var("PATH"),
        }
    }

    #[test]
    fn parse_rate_handles_fraction() {
        assert!((parse_rate("30000/1001").unwrap() - 29.97).abs() < 0.01);
        assert_eq!(parse_rate("0/0"), None);
    }
}
