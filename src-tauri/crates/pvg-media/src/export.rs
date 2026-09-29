//! Multi-track sequence export via FFmpeg argv (no shell).
//!
//! Composes video/overlay/image layers, drawtext for titles, effect filters,
//! and mixed audio tracks into a real H.264/AAC MP4 under `{project}/renders/`.

use crate::error::{MediaError, MediaResult};
use crate::ffmpeg::{command_with_args, locate_ffmpeg, run_checked, ArgvBuilder};
use crate::path_safe::{derivative_output_path, ensure_derivative_dir};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};

pub const RENDERS_DIR: &str = "renders";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportPreset {
    pub width: u32,
    pub height: u32,
    pub video_bitrate: String,
    pub audio_bitrate: String,
}

impl ExportPreset {
    pub fn from_name(name: &str) -> Self {
        match name {
            "720p" => Self {
                width: 1280,
                height: 720,
                video_bitrate: "5M".into(),
                audio_bitrate: "160k".into(),
            },
            "4k" => Self {
                width: 3840,
                height: 2160,
                video_bitrate: "20M".into(),
                audio_bitrate: "192k".into(),
            },
            _ => Self {
                width: 1920,
                height: 1080,
                video_bitrate: "8M".into(),
                audio_bitrate: "192k".into(),
            },
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub output_path: String,
    pub duration_ms: u64,
    pub width: u32,
    pub height: u32,
    pub clip_count: usize,
    pub video_layers: usize,
    pub text_layers: usize,
    pub audio_layers: usize,
}

#[derive(Debug, Clone)]
struct VisualClip {
    path: Option<PathBuf>,
    kind: String,
    timeline_start: f64,
    timeline_end: f64,
    source_in: f64,
    source_out: f64,
    opacity: f64,
    x: f64,
    y: f64,
    scale_x: f64,
    scale_y: f64,
    rotation: f64,
    effects_vf: String,
    text: Option<TextOverlay>,
    fade_in: f64,
    fade_out: f64,
}

#[derive(Debug, Clone)]
struct TextOverlay {
    content: String,
    font_size: u32,
    color: String,
    x: f64,
    y: f64,
}

#[derive(Debug, Clone)]
struct AudioClip {
    path: PathBuf,
    timeline_start: f64,
    source_in: f64,
    source_out: f64,
    volume: f64,
    fade_in: f64,
    fade_out: f64,
}

fn num(v: &Value, key: &str, default: f64) -> f64 {
    v.get(key).and_then(|x| x.as_f64()).unwrap_or(default)
}

fn bool_val(v: &Value, key: &str, default: bool) -> bool {
    v.get(key).and_then(|x| x.as_bool()).unwrap_or(default)
}

fn write_ass_file(
    path: &Path,
    texts: &[(f64, f64, &TextOverlay, f64)],
    width: u32,
    height: u32,
) -> MediaResult<()> {
    let mut body = String::from(
        "[Script Info]\nScriptType: v4.00+\nPlayResX: {w}\nPlayResY: {h}\nWrapStyle: 0\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,DejaVu Sans,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,2,1,5,20,20,20,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
            .replace("{w}", &width.to_string())
            .replace("{h}", &height.to_string()),
    );
    for (start, end, t, opacity) in texts {
        let a = ((1.0 - opacity.clamp(0.0, 1.0)) * 255.0).round() as u32;
        let color = ass_color(&t.color, a);
        let fontsize = t.font_size.max(8);
        // Override style inline via {\fsN\c&H...&\alpha&H..}
        let text = t
            .content
            .replace('\\', "\\\\")
            .replace('{', "(")
            .replace('}', ")");
        body.push_str(&format!(
            "Dialogue: 0,{start},{end},Default,,0,0,0,,{{\\fs{fontsize}\\c{color}\\pos({x},{y})}}{text}\n",
            start = format_ass_time(*start),
            end = format_ass_time(*end),
            x = (width as f64 / 2.0 + t.x).round() as i32,
            y = (height as f64 / 2.0 + t.y).round() as i32,
        ));
    }
    std::fs::write(path, body).map_err(|e| MediaError::Io(e.to_string()))?;
    Ok(())
}

fn format_ass_time(sec: f64) -> String {
    let total_cs = (sec.max(0.0) * 100.0).round() as u64;
    let h = total_cs / 360_000;
    let m = (total_cs / 6_000) % 60;
    let s = (total_cs / 100) % 60;
    let cs = total_cs % 100;
    format!("{h}:{m:02}:{s:02}.{cs:02}")
}

fn ass_color(hex: &str, alpha: u32) -> String {
    let h = hex.trim_start_matches('#');
    let (r, g, b) = if h.len() >= 6 {
        (
            u32::from_str_radix(&h[0..2], 16).unwrap_or(255),
            u32::from_str_radix(&h[2..4], 16).unwrap_or(255),
            u32::from_str_radix(&h[4..6], 16).unwrap_or(255),
        )
    } else {
        (255, 255, 255)
    };
    // ASS uses &HAABBGGRR
    format!("&H{alpha:02X}{b:02X}{g:02X}{r:02X}&")
}

fn escape_filter_path(path: &Path) -> String {
    path.to_string_lossy()
        .replace('\\', "/")
        .replace(':', "\\:")
        .replace('\'', "\\'")
        .replace('[', "\\[")
        .replace(']', "\\]")
}

fn effects_to_vf(effects: &Value) -> String {
    let Some(arr) = effects.as_array() else {
        return String::new();
    };
    let mut parts = Vec::new();
    for e in arr {
        if !bool_val(e, "enabled", true) {
            continue;
        }
        let ty = e.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let params = e
            .get("params")
            .cloned()
            .unwrap_or(Value::Object(Default::default()));
        match ty {
            "blur" => {
                let r = num(&params, "radius", 4.0).clamp(0.0, 50.0);
                parts.push(format!("boxblur={r}:{r}"));
            }
            "brightness_contrast" => {
                let b = num(&params, "brightness", 0.0).clamp(-1.0, 1.0);
                let c = num(&params, "contrast", 1.0).clamp(0.0, 3.0);
                parts.push(format!("eq=brightness={b}:contrast={c}"));
            }
            "saturation" => {
                let a = num(&params, "amount", 1.0).clamp(0.0, 3.0);
                parts.push(format!("eq=saturation={a}"));
            }
            "exposure" => {
                let a = num(&params, "amount", 0.0).clamp(-1.0, 1.0);
                parts.push(format!("eq=brightness={a}"));
            }
            "grayscale" => {
                parts.push("hue=s=0".into());
            }
            "sharpen" => {
                parts.push("unsharp=5:5:1.0:5:5:0.0".into());
            }
            "vignette" => {
                parts.push("vignette=PI/4".into());
            }
            "temperature" | "tint" => {
                let a = num(&params, "amount", 0.0).clamp(-1.0, 1.0);
                parts.push(format!("colorbalance=rs={a}:gs=0:bs={}", -a));
            }
            _ => {}
        }
    }
    parts.join(",")
}

fn resolve_asset_file(project_root: &Path, assets: &[Value], asset_id: &str) -> MediaResult<PathBuf> {
    let asset = assets
        .iter()
        .find(|a| a.get("id").and_then(|v| v.as_str()) == Some(asset_id))
        .ok_or_else(|| MediaError::InvalidInput(format!("asset {asset_id} missing")))?;
    if let Some(rel) = asset.get("relativePath").and_then(|v| v.as_str()) {
        let abs = project_root.join(rel);
        if abs.is_file() {
            return Ok(abs);
        }
    }
    if let Some(abs_path) = asset
        .get("location")
        .and_then(|l| l.get("absolutePath"))
        .and_then(|v| v.as_str())
    {
        let p = PathBuf::from(abs_path);
        if p.is_file() {
            return Ok(p);
        }
    }
    Err(MediaError::InvalidInput(format!(
        "media file missing for asset {asset_id}"
    )))
}

fn parse_composition(
    project_json: &Value,
    sequence_id: &str,
    project_root: &Path,
) -> MediaResult<(Vec<VisualClip>, Vec<AudioClip>, f64, u32, u32)> {
    let sequences = project_json
        .get("sequences")
        .and_then(|v| v.as_array())
        .ok_or_else(|| MediaError::InvalidInput("project has no sequences".into()))?;
    let seq = sequences
        .iter()
        .find(|s| s.get("id").and_then(|v| v.as_str()) == Some(sequence_id))
        .or_else(|| sequences.first())
        .ok_or_else(|| MediaError::InvalidInput("sequence not found".into()))?;

    let width = seq.get("width").and_then(|v| v.as_u64()).unwrap_or(1920) as u32;
    let height = seq.get("height").and_then(|v| v.as_u64()).unwrap_or(1080) as u32;
    let duration_ms = num(seq, "durationMs", 0.0).max(0.0);
    let duration_sec = (duration_ms / 1000.0).max(0.1);

    let assets = project_json
        .get("assets")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let tracks = seq
        .get("tracks")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut visuals: Vec<VisualClip> = Vec::new();
    let mut audios: Vec<AudioClip> = Vec::new();

    // Bottom track first for overlay order (matches composeAtTime iteration).
    for track in tracks.iter().rev() {
        let track_type = track.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let muted = bool_val(track, "muted", false);
        let visible = bool_val(track, "visible", true);
        let enabled = bool_val(track, "enabled", true);
        if !enabled {
            continue;
        }

        let clips = track
            .get("clips")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default();

        for clip in clips {
            if !bool_val(&clip, "enabled", true) {
                continue;
            }
            let kind = clip
                .get("kind")
                .and_then(|v| v.as_str())
                .unwrap_or("video")
                .to_string();
            let start = num(&clip, "timelineStartMs", 0.0) / 1000.0;
            let end = clip
                .get("timelineEndMs")
                .and_then(|v| v.as_f64())
                .unwrap_or(num(&clip, "timelineStartMs", 0.0) + 1000.0)
                / 1000.0;
            if end <= start {
                continue;
            }
            let source_in = num(&clip, "sourceInMs", 0.0) / 1000.0;
            let source_out = clip
                .get("sourceOutMs")
                .and_then(|v| v.as_f64())
                .map(|v| v / 1000.0)
                .unwrap_or(source_in + (end - start));
            let transform = clip
                .get("transform")
                .cloned()
                .unwrap_or(Value::Object(Default::default()));
            let opacity = num(&transform, "opacity", 1.0).clamp(0.0, 1.0);
            let volume = if muted {
                0.0
            } else {
                num(&clip, "volume", 1.0).clamp(0.0, 2.0)
            };

            let fade_in = clip
                .get("transitionIn")
                .and_then(|t| t.get("durationMs"))
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0)
                / 1000.0;
            let fade_out = clip
                .get("transitionOut")
                .and_then(|t| t.get("durationMs"))
                .and_then(|v| v.as_f64())
                .unwrap_or(0.0)
                / 1000.0;

            if track_type == "audio" || kind == "audio" {
                if muted || volume <= 0.0 {
                    continue;
                }
                let Some(asset_id) = clip.get("assetId").and_then(|v| v.as_str()) else {
                    continue;
                };
                let path = resolve_asset_file(project_root, &assets, asset_id)?;
                audios.push(AudioClip {
                    path,
                    timeline_start: start,
                    source_in,
                    source_out,
                    volume,
                    fade_in,
                    fade_out,
                });
                continue;
            }

            if !visible {
                continue;
            }

            if kind == "text" {
                if let Some(text) = clip.get("text") {
                    let content = text
                        .get("content")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    if content.is_empty() {
                        continue;
                    }
                    visuals.push(VisualClip {
                        path: None,
                        kind: "text".into(),
                        timeline_start: start,
                        timeline_end: end,
                        source_in: 0.0,
                        source_out: end - start,
                        opacity,
                        x: num(&transform, "x", 0.0),
                        y: num(&transform, "y", 0.0),
                        scale_x: num(&transform, "scaleX", 1.0),
                        scale_y: num(&transform, "scaleY", 1.0),
                        rotation: num(&transform, "rotation", 0.0),
                        effects_vf: String::new(),
                        text: Some(TextOverlay {
                            content,
                            font_size: text
                                .get("fontSize")
                                .and_then(|v| v.as_f64())
                                .unwrap_or(48.0) as u32,
                            color: text
                                .get("color")
                                .and_then(|v| v.as_str())
                                .unwrap_or("#FFFFFF")
                                .trim_start_matches('#')
                                .to_string(),
                            x: num(&transform, "x", 0.0),
                            y: num(&transform, "y", 0.0),
                        }),
                        fade_in,
                        fade_out,
                    });
                }
                continue;
            }

            if matches!(kind.as_str(), "video" | "image") {
                let Some(asset_id) = clip.get("assetId").and_then(|v| v.as_str()) else {
                    continue;
                };
                let path = resolve_asset_file(project_root, &assets, asset_id)?;
                // Also pull linked audio from video clips that have audio
                if kind == "video" && !muted && volume > 0.0 {
                    audios.push(AudioClip {
                        path: path.clone(),
                        timeline_start: start,
                        source_in,
                        source_out,
                        volume,
                        fade_in,
                        fade_out,
                    });
                }
                visuals.push(VisualClip {
                    path: Some(path),
                    kind,
                    timeline_start: start,
                    timeline_end: end,
                    source_in,
                    source_out,
                    opacity,
                    x: num(&transform, "x", 0.0),
                    y: num(&transform, "y", 0.0),
                    scale_x: num(&transform, "scaleX", 1.0).max(0.01),
                    scale_y: num(&transform, "scaleY", 1.0).max(0.01),
                    rotation: num(&transform, "rotation", 0.0),
                    effects_vf: effects_to_vf(
                        clip.get("effects")
                            .unwrap_or(&Value::Array(vec![])),
                    ),
                    text: None,
                    fade_in,
                    fade_out,
                });
            }
        }
    }

    if visuals.is_empty() && audios.is_empty() {
        return Err(MediaError::InvalidInput(
            "no exportable clips in sequence".into(),
        ));
    }

    Ok((visuals, audios, duration_sec, width, height))
}

fn run_export(argv: ArgvBuilder) -> MediaResult<()> {
    let ffmpeg = locate_ffmpeg()?;
    let args = argv.into_vec();
    let cmd = command_with_args(&ffmpeg, &args)?;
    let output = run_checked(cmd)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(MediaError::FfmpegFailed(format!("export failed: {stderr}")));
    }
    Ok(())
}

/// Export a composed sequence to H.264/AAC MP4.
pub fn export_sequence_mp4(
    project_root: &Path,
    project_json: &Value,
    sequence_id: &str,
    output_file_name: &str,
    preset_name: &str,
) -> MediaResult<ExportResult> {
    if output_file_name.contains("..")
        || output_file_name.contains('/')
        || output_file_name.contains('\\')
        || !output_file_name.ends_with(".mp4")
    {
        return Err(MediaError::InvalidInput(
            "output must be a simple .mp4 filename".into(),
        ));
    }

    ensure_derivative_dir(project_root, RENDERS_DIR)?;
    let output = derivative_output_path(project_root, RENDERS_DIR, output_file_name)?;
    let preset = ExportPreset::from_name(preset_name);
    let (visuals, audios, duration_sec, seq_w, seq_h) =
        parse_composition(project_json, sequence_id, project_root)?;
    let w = if preset.width > 0 { preset.width } else { seq_w };
    let h = if preset.height > 0 { preset.height } else { seq_h };

    // Collect media inputs (visual paths + audio paths). Text uses drawtext only.
    let mut argv = ArgvBuilder::new().flag("-y");
    let mut input_paths: Vec<PathBuf> = Vec::new();
    let mut visual_input_idx: Vec<Option<usize>> = Vec::new();

    for v in &visuals {
        if let Some(path) = &v.path {
            visual_input_idx.push(Some(input_paths.len()));
            input_paths.push(path.clone());
        } else {
            visual_input_idx.push(None);
        }
    }
    let audio_input_start = input_paths.len();
    for a in &audios {
        input_paths.push(a.path.clone());
    }
    for path in &input_paths {
        argv = argv.flag("-i").path(path)?;
    }

    // Build filter_complex
    let mut filter = String::new();
    // Base canvas
    filter.push_str(&format!(
        "color=c=black:s={w}x{h}:d={duration_sec:.3}:r=30[base];"
    ));

    let mut current = "base".to_string();
    let mut video_layers = 0usize;
    let mut text_layers = 0usize;
    let mut text_events: Vec<(f64, f64, TextOverlay, f64)> = Vec::new();

    for (vi, v) in visuals.iter().enumerate() {
        let enable = format!(
            "between(t\\,{:.3}\\,{:.3})",
            v.timeline_start, v.timeline_end
        );
        if v.kind == "text" {
            if let Some(t) = &v.text {
                text_events.push((v.timeline_start, v.timeline_end, t.clone(), v.opacity));
                text_layers += 1;
            }
            continue;
        }

        let Some(in_idx) = visual_input_idx[vi] else {
            continue;
        };

        let clip_dur = (v.timeline_end - v.timeline_start).max(0.04);
        let src_dur = (v.source_out - v.source_in).max(0.04);
        let mut chain = format!(
            "[{in_idx}:v]trim=start={:.3}:duration={:.3},setpts=PTS-STARTPTS",
            v.source_in,
            src_dur.min(clip_dur * 4.0)
        );
        let tw = (w as f64 * v.scale_x).round().max(2.0) as u32;
        let th = (h as f64 * v.scale_y).round().max(2.0) as u32;
        chain.push_str(&format!(
            ",scale={tw}:{th}:force_original_aspect_ratio=decrease"
        ));
        if v.rotation.abs() > 0.01 {
            chain.push_str(&format!(
                ",rotate={:.6}*PI/180:fillcolor=black@0",
                v.rotation
            ));
        }
        if !v.effects_vf.is_empty() {
            chain.push(',');
            chain.push_str(&v.effects_vf);
        }
        if v.opacity < 0.999 {
            chain.push_str(&format!(
                ",format=rgba,colorchannelmixer=aa={:.3}",
                v.opacity
            ));
        }
        if v.fade_in > 0.01 || v.fade_out > 0.01 {
            let fi = v.fade_in.max(0.0);
            let fo = v.fade_out.max(0.0);
            let st = (clip_dur - fo).max(0.0);
            chain.push_str(&format!(
                ",fade=t=in:st=0:d={fi:.3},fade=t=out:st={st:.3}:d={fo:.3}"
            ));
        }
        chain.push_str(&format!(
            ",setpts=PTS+{:.3}/TB[fg{vi}];",
            v.timeline_start
        ));
        filter.push_str(&chain);

        let next = format!("v{vi}");
        let ox = format!("(W-w)/2+{:.0}", v.x);
        let oy = format!("(H-h)/2+{:.0}", v.y);
        filter.push_str(&format!(
            "[{current}][fg{vi}]overlay=x={ox}:y={oy}:eof_action=pass:enable='{enable}'[{next}];"
        ));
        current = next;
        video_layers += 1;
    }

    if !text_events.is_empty() {
        let ass_path = output.with_extension("ass");
        let refs: Vec<(f64, f64, &TextOverlay, f64)> = text_events
            .iter()
            .map(|(a, b, t, o)| (*a, *b, t, *o))
            .collect();
        write_ass_file(&ass_path, &refs, w, h)?;
        let next = "vtext".to_string();
        filter.push_str(&format!(
            "[{current}]ass='{}'[{next}];",
            escape_filter_path(&ass_path)
        ));
        current = next;
    }

    // Ensure we have a final video label
    filter.push_str(&format!("[{current}]format=yuv420p[vout];"));

    // Audio mix
    let mut audio_layers = 0usize;
    if audios.is_empty() {
        filter.push_str(&format!(
            "anullsrc=r=48000:cl=stereo,atrim=0:{duration_sec:.3}[aout]"
        ));
    } else {
        let mut labels = Vec::new();
        for (ai, a) in audios.iter().enumerate() {
            let in_idx = audio_input_start + ai;
            let dur = (a.source_out - a.source_in).max(0.04);
            let delay_ms = (a.timeline_start * 1000.0).round().max(0.0) as u64;
            let mut achain = format!(
                "[{in_idx}:a]atrim=start={:.3}:duration={:.3},asetpts=PTS-STARTPTS,volume={:.3}",
                a.source_in, dur, a.volume
            );
            if a.fade_in > 0.01 {
                achain.push_str(&format!(",afade=t=in:st=0:d={:.3}", a.fade_in));
            }
            if a.fade_out > 0.01 {
                let st = (dur - a.fade_out).max(0.0);
                achain.push_str(&format!(",afade=t=out:st={st:.3}:d={:.3}", a.fade_out));
            }
            achain.push_str(&format!(",adelay={delay_ms}|{delay_ms}[a{ai}];"));
            filter.push_str(&achain);
            labels.push(format!("[a{ai}]"));
            audio_layers += 1;
        }
        if labels.len() == 1 {
            filter.push_str(&format!("{}apad,atrim=0:{duration_sec:.3}[aout]", labels[0]));
        } else {
            filter.push_str(&format!(
                "{}amix=inputs={}:duration=longest:normalize=0,apad,atrim=0:{duration_sec:.3}[aout]",
                labels.join(""),
                labels.len()
            ));
        }
    }

    argv = argv
        .flag("-filter_complex")
        .arg(filter)
        .flag("-map")
        .arg("[vout]")
        .flag("-map")
        .arg("[aout]")
        .flag("-c:v")
        .arg("libx264")
        .flag("-preset")
        .arg("veryfast")
        .flag("-b:v")
        .arg(&preset.video_bitrate)
        .flag("-c:a")
        .arg("aac")
        .flag("-b:a")
        .arg(&preset.audio_bitrate)
        .flag("-t")
        .arg(format!("{duration_sec:.3}"))
        .flag("-movflags")
        .arg("+faststart")
        .path(&output)?;

    run_export(argv)?;

    if !output.is_file() {
        return Err(MediaError::FfmpegFailed(
            "export output missing after ffmpeg".into(),
        ));
    }

    Ok(ExportResult {
        output_path: output.to_string_lossy().into_owned(),
        duration_ms: (duration_sec * 1000.0).round() as u64,
        width: w,
        height: h,
        clip_count: visuals.len() + audios.len(),
        video_layers,
        text_layers,
        audio_layers,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use std::process::Command;

    fn write_fixture_mp4(path: &Path, color: &str, seconds: f64) {
        let status = Command::new("ffmpeg")
            .args([
                "-y",
                "-f",
                "lavfi",
                "-i",
                &format!("color=c={color}:s=320x240:d={seconds}"),
                "-f",
                "lavfi",
                "-i",
                &format!("sine=frequency=440:duration={seconds}"),
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-c:a",
                "aac",
                "-shortest",
                path.to_str().unwrap(),
            ])
            .status()
            .expect("spawn ffmpeg");
        assert!(status.success());
    }

    #[test]
    fn multi_track_text_audio_export_produces_mp4() {
        let Ok(ffmpeg) = locate_ffmpeg() else {
            eprintln!("skip: ffmpeg unavailable");
            return;
        };
        let _ = ffmpeg;
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("media")).unwrap();
        let vpath = root.join("media/a.mp4");
        write_fixture_mp4(&vpath, "blue", 2.0);

        let project = json!({
            "sequences": [{
                "id": "seq1",
                "durationMs": 2000,
                "width": 640,
                "height": 360,
                "tracks": [
                    {
                        "type": "video",
                        "enabled": true,
                        "visible": true,
                        "muted": false,
                        "clips": [{
                            "kind": "video",
                            "enabled": true,
                            "assetId": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                            "timelineStartMs": 0,
                            "timelineEndMs": 2000,
                            "sourceInMs": 0,
                            "sourceOutMs": 2000,
                            "volume": 1,
                            "transform": { "opacity": 1, "x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0 },
                            "effects": [{ "type": "grayscale", "enabled": true, "params": {} }],
                            "transitionIn": { "type": "fade", "durationMs": 200 },
                            "transitionOut": null
                        }]
                    },
                    {
                        "type": "text",
                        "enabled": true,
                        "visible": true,
                        "muted": false,
                        "clips": [{
                            "kind": "text",
                            "enabled": true,
                            "assetId": null,
                            "timelineStartMs": 0,
                            "timelineEndMs": 2000,
                            "transform": { "opacity": 1, "x": 0, "y": -40, "scaleX": 1, "scaleY": 1, "rotation": 0 },
                            "text": { "content": "PVG TEST", "fontSize": 36, "color": "#FFFFFF" },
                            "effects": []
                        }]
                    }
                ]
            }],
            "assets": [{
                "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                "relativePath": "media/a.mp4",
                "kind": "video"
            }]
        });

        let result = export_sequence_mp4(root, &project, "seq1", "out.mp4", "720p").unwrap();
        assert!(PathBuf::from(&result.output_path).is_file());
        assert!(result.video_layers >= 1);
        assert!(result.text_layers >= 1);
        assert!(result.audio_layers >= 1);
        assert!(result.duration_ms >= 1500);
    }
}
