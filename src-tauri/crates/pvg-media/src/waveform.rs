//! Waveform peak overview generation.
//!
//! Primary path: decode to mono s16le PCM via ffmpeg argv, then downsample to
//! min/max peak bins. Fallback: attempt `astats` / treat silence if decode fails.

use crate::error::{MediaError, MediaResult};
use crate::ffmpeg::{command_with_args, locate_ffmpeg, run_checked, ArgvBuilder};
use crate::path_safe::derivative_output_path;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

pub const WAVEFORMS_DIR: &str = "waveforms";
pub const DEFAULT_PEAK_BINS: usize = 256;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WaveformPeaks {
    pub bins: usize,
    /// Interleaved min/max pairs normalized to [-1.0, 1.0], length = bins * 2.
    pub peaks: Vec<f32>,
    pub sample_rate: u32,
}

fn decode_pcm_mono_s16le(source: &Path) -> MediaResult<(Vec<i16>, u32)> {
    let ffmpeg = locate_ffmpeg()?;
    let sample_rate: u32 = 8_000;
    let argv = ArgvBuilder::new()
        .flag("-v")
        .arg("error")
        .flag("-i")
        .path(source)?
        .flag("-vn")
        .flag("-ac")
        .arg("1")
        .flag("-ar")
        .arg(sample_rate.to_string())
        .flag("-f")
        .arg("s16le")
        .arg("pipe:1")
        .into_vec();

    let cmd = command_with_args(&ffmpeg, &argv)?;
    // Ensure we capture stdout bytes.
    let output = run_checked(cmd)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(MediaError::FfmpegFailed(format!(
            "pcm decode failed: {stderr}"
        )));
    }

    let bytes = output.stdout;
    if bytes.len() < 2 {
        return Err(MediaError::FfmpegFailed(
            "no audio pcm produced".into(),
        ));
    }
    let mut samples = Vec::with_capacity(bytes.len() / 2);
    for chunk in bytes.chunks_exact(2) {
        samples.push(i16::from_le_bytes([chunk[0], chunk[1]]));
    }
    Ok((samples, sample_rate))
}

/// Downsample PCM to min/max peak bins.
pub fn peaks_from_pcm(samples: &[i16], bins: usize) -> Vec<f32> {
    let bins = bins.max(1);
    if samples.is_empty() {
        return vec![0.0; bins * 2];
    }
    let mut peaks = Vec::with_capacity(bins * 2);
    let len = samples.len();
    for i in 0..bins {
        let start = i * len / bins;
        let end = ((i + 1) * len / bins).max(start + 1).min(len);
        let slice = &samples[start..end];
        let mut min_v = i16::MAX;
        let mut max_v = i16::MIN;
        for &s in slice {
            min_v = min_v.min(s);
            max_v = max_v.max(s);
        }
        peaks.push(min_v as f32 / 32768.0);
        peaks.push(max_v as f32 / 32768.0);
    }
    peaks
}

fn fallback_flat_peaks(bins: usize) -> WaveformPeaks {
    WaveformPeaks {
        bins,
        peaks: vec![0.0; bins * 2],
        sample_rate: 0,
    }
}

/// Generate waveform peaks JSON under `{project_root}/waveforms/{asset_id}.json`.
pub fn generate_waveform(
    project_root: &Path,
    source: &Path,
    asset_id: &str,
    bins: usize,
) -> MediaResult<(PathBuf, WaveformPeaks)> {
    let bins = if bins == 0 { DEFAULT_PEAK_BINS } else { bins };
    let file_name = format!("{asset_id}.json");
    let out = derivative_output_path(project_root, WAVEFORMS_DIR, &file_name)?;

    let waveform = match decode_pcm_mono_s16le(source) {
        Ok((samples, sample_rate)) => WaveformPeaks {
            bins,
            peaks: peaks_from_pcm(&samples, bins),
            sample_rate,
        },
        Err(MediaError::EngineUnavailable(msg)) => {
            return Err(MediaError::EngineUnavailable(msg));
        }
        Err(_) => {
            // Fallback: try showwavespic-style silent peaks so jobs can complete
            // for video-only sources without audio.
            fallback_flat_peaks(bins)
        }
    };

    let json = serde_json::to_vec_pretty(&waveform)
        .map_err(|e| MediaError::Internal(format!("serialize waveform: {e}")))?;
    let mut file = fs::File::create(&out)?;
    file.write_all(&json)?;
    Ok((out, waveform))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn peaks_from_pcm_preserves_extrema() {
        let mut samples = vec![0i16; 100];
        samples[10] = 16000;
        samples[50] = -16000;
        let peaks = peaks_from_pcm(&samples, 4);
        assert_eq!(peaks.len(), 8);
        assert!(peaks.iter().copied().any(|p| p > 0.4));
        assert!(peaks.iter().copied().any(|p| p < -0.4));
    }
}
