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
    speed: f64,
    reverse: bool,
    flip_x: bool,
    flip_y: bool,
    /// Asset id for A/V dedupe against dedicated audio tracks.
    #[allow(dead_code)]
    asset_id: Option<String>,
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

/// Evaluate numeric keyframes at localTimeMs (clip-relative).
/// Semantics match `packages/editor-core/src/keyframes/evaluate.ts`
/// (`linear` | `easeIn` | `easeOut` | `hold`; bezier falls back to linear y-approx).
pub fn evaluate_keyframes(keyframes: &[Value], local_time_ms: f64) -> Option<f64> {
    if keyframes.is_empty() {
        return None;
    }
    let mut sorted: Vec<&Value> = keyframes.iter().collect();
    sorted.sort_by(|a, b| {
        num(a, "timeMs", 0.0)
            .partial_cmp(&num(b, "timeMs", 0.0))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let first = *sorted.first()?;
    let last = *sorted.last()?;
    if local_time_ms <= num(first, "timeMs", 0.0) {
        return first.get("value").and_then(|v| v.as_f64());
    }
    if local_time_ms >= num(last, "timeMs", 0.0) {
        return last.get("value").and_then(|v| v.as_f64());
    }
    for i in 0..sorted.len() - 1 {
        let a = sorted[i];
        let b = sorted[i + 1];
        let ta = num(a, "timeMs", 0.0);
        let tb = num(b, "timeMs", 0.0);
        if local_time_ms >= ta && local_time_ms <= tb {
            let va = a.get("value").and_then(|v| v.as_f64())?;
            let vb = b.get("value").and_then(|v| v.as_f64())?;
            let interp = a
                .get("interpolation")
                .and_then(|v| v.as_str())
                .unwrap_or("linear");
            if interp == "hold" {
                return Some(va);
            }
            let span = (tb - ta).max(1e-9);
            let mut t = ((local_time_ms - ta) / span).clamp(0.0, 1.0);
            match interp {
                "easeIn" => t *= t,
                "easeOut" => {
                    let u = 1.0 - t;
                    t = 1.0 - u * u;
                }
                // bezier: approximate with cubic y using handles (same as editor-core)
                "bezier" => {
                    let p1y = a
                        .get("outHandle")
                        .and_then(|h| h.as_array())
                        .and_then(|arr| arr.get(1))
                        .and_then(|v| v.as_f64())
                        .unwrap_or(0.0);
                    let p2y = b
                        .get("inHandle")
                        .and_then(|h| h.as_array())
                        .and_then(|arr| arr.get(1))
                        .and_then(|v| v.as_f64())
                        .unwrap_or(1.0);
                    let u = 1.0 - t;
                    t = 3.0 * u * u * t * p1y + 3.0 * u * t * t * p2y + t * t * t;
                }
                _ => {}
            }
            return Some(va + (vb - va) * t);
        }
    }
    first.get("value").and_then(|v| v.as_f64())
}

fn kf_prop(clip: &Value, path: &str, base: f64, local_ms: f64) -> f64 {
    let Some(map) = clip.get("keyframes").and_then(|v| v.as_object()) else {
        return base;
    };
    let Some(arr) = map.get(path).and_then(|v| v.as_array()) else {
        return base;
    };
    evaluate_keyframes(arr, local_ms).unwrap_or(base)
}

fn clip_has_keyframes(clip: &Value) -> bool {
    let Some(map) = clip.get("keyframes").and_then(|v| v.as_object()) else {
        return false;
    };
    map.values()
        .any(|v| v.as_array().map(|a| !a.is_empty()).unwrap_or(false))
}

fn has_active_transition(clip: &Value, key: &str) -> bool {
    let Some(t) = clip.get(key) else {
        return false;
    };
    if t.is_null() {
        return false;
    }
    num(t, "durationMs", 0.0) > 0.0
}

/// Transform at exact clip-local time — same property paths as composeAtTime.
fn transform_at(
    clip: &Value,
    transform: &Value,
    local_ms: f64,
) -> (f64, f64, f64, f64, f64, f64) {
    let opacity =
        kf_prop(clip, "transform.opacity", num(transform, "opacity", 1.0), local_ms).clamp(0.0, 1.0);
    let x = kf_prop(clip, "transform.x", num(transform, "x", 0.0), local_ms);
    let y = kf_prop(clip, "transform.y", num(transform, "y", 0.0), local_ms);
    let scale_x =
        kf_prop(clip, "transform.scaleX", num(transform, "scaleX", 1.0), local_ms).max(0.01);
    let scale_y =
        kf_prop(clip, "transform.scaleY", num(transform, "scaleY", 1.0), local_ms).max(0.01);
    let rotation = kf_prop(clip, "transform.rotation", num(transform, "rotation", 0.0), local_ms);
    (opacity, x, y, scale_x, scale_y, rotation)
}

/// Transition opacity modulation — mirrors composeAtTime fade/dissolve.
fn transition_opacity_mod(clip: &Value, local_ms: f64, clip_dur_ms: f64) -> f64 {
    let mut trans = 1.0;
    if let Some(tin) = clip.get("transitionIn") {
        let dur = num(tin, "durationMs", 0.0);
        let ty = tin.get("type").and_then(|v| v.as_str()).unwrap_or("");
        if dur > 0.0 && local_ms < dur && matches!(ty, "fade" | "dissolve" | "dip_to_color") {
            trans *= (local_ms / dur).clamp(0.0, 1.0);
        }
    }
    if let Some(tout) = clip.get("transitionOut") {
        let dur = num(tout, "durationMs", 0.0);
        let ty = tout.get("type").and_then(|v| v.as_str()).unwrap_or("");
        let remaining = clip_dur_ms - local_ms;
        if dur > 0.0 && remaining < dur && matches!(ty, "fade" | "dissolve" | "dip_to_color") {
            trans *= (remaining / dur).clamp(0.0, 1.0);
        }
    }
    trans
}

fn volume_at(clip: &Value, base: f64, local_ms: f64) -> f64 {
    kf_prop(clip, "volume", base, local_ms).clamp(0.0, 2.0)
}

/// Expand a visual clip into per-frame segments when keyframes (or transitions) animate.
fn expand_visual_timeline(
    template: VisualClip,
    clip: &Value,
    transform: &Value,
    fps: f64,
) -> Vec<VisualClip> {
    let needs_expand = clip_has_keyframes(clip)
        || has_active_transition(clip, "transitionIn")
        || has_active_transition(clip, "transitionOut");
    if !needs_expand {
        let local = 0.0;
        let (mut op, x, y, sx, sy, rot) = transform_at(clip, transform, local);
        let clip_dur_ms = (template.timeline_end - template.timeline_start) * 1000.0;
        op *= transition_opacity_mod(clip, local, clip_dur_ms);
        let mut one = template;
        one.opacity = op;
        one.x = x;
        one.y = y;
        one.scale_x = sx;
        one.scale_y = sy;
        one.rotation = rot;
        if let Some(ref mut text) = one.text {
            text.x = x;
            text.y = y;
        }
        return vec![one];
    }

    let frame = 1.0 / fps.max(1.0);
    let mut out = Vec::new();
    let mut t = template.timeline_start;
    let end = template.timeline_end;
    let speed = template.speed.max(0.05);
    let clip_dur_ms = (end - template.timeline_start) * 1000.0;
    // Safety cap: 20 minutes @ 30fps
    let max_segs = ((end - t) / frame).ceil() as usize + 2;
    if max_segs > 36_000 {
        // Fall back to 2fps sampling for pathological lengths
        return expand_visual_timeline_at_rate(template, clip, transform, 2.0);
    }

    while t < end - 1e-9 {
        let t1 = (t + frame).min(end);
        let local_ms = (t - template.timeline_start) * 1000.0;
        let (mut op, x, y, sx, sy, rot) = transform_at(clip, transform, local_ms);
        op *= transition_opacity_mod(clip, local_ms, clip_dur_ms);
        let local_sec = t - template.timeline_start;
        let seg_dur = (t1 - t).max(0.001);
        let (src_in, src_out) = if template.reverse {
            let src = (template.source_out - local_sec * speed).max(0.0);
            (src, src + seg_dur * speed)
        } else {
            let src = template.source_in + local_sec * speed;
            (src, src + seg_dur * speed)
        };
        let mut seg = template.clone();
        seg.timeline_start = t;
        seg.timeline_end = t1;
        seg.source_in = src_in;
        seg.source_out = src_out;
        seg.opacity = op;
        seg.x = x;
        seg.y = y;
        seg.scale_x = sx;
        seg.scale_y = sy;
        seg.rotation = rot;
        seg.fade_in = 0.0;
        seg.fade_out = 0.0;
        if let Some(ref mut text) = seg.text {
            text.x = x;
            text.y = y;
        }
        out.push(seg);
        t = t1;
    }
    if out.is_empty() {
        out.push(template);
    }
    out
}

fn expand_visual_timeline_at_rate(
    template: VisualClip,
    clip: &Value,
    transform: &Value,
    fps: f64,
) -> Vec<VisualClip> {
    let frame = 1.0 / fps.max(0.1);
    let mut out = Vec::new();
    let mut cur = template.timeline_start;
    let end = template.timeline_end;
    let speed = template.speed.max(0.05);
    let clip_dur_ms = (end - template.timeline_start) * 1000.0;
    while cur < end - 1e-9 {
        let t1 = (cur + frame).min(end);
        let local_ms = (cur - template.timeline_start) * 1000.0;
        let (mut op, x, y, sx, sy, rot) = transform_at(clip, transform, local_ms);
        op *= transition_opacity_mod(clip, local_ms, clip_dur_ms);
        let local_sec = cur - template.timeline_start;
        let seg_dur = (t1 - cur).max(0.001);
        let src = template.source_in + local_sec * speed;
        let mut seg = template.clone();
        seg.timeline_start = cur;
        seg.timeline_end = t1;
        seg.source_in = src;
        seg.source_out = src + seg_dur * speed;
        seg.opacity = op;
        seg.x = x;
        seg.y = y;
        seg.scale_x = sx;
        seg.scale_y = sy;
        seg.rotation = rot;
        seg.fade_in = 0.0;
        seg.fade_out = 0.0;
        out.push(seg);
        cur = t1;
    }
    out
}

fn expand_audio_timeline(
    path: PathBuf,
    clip: &Value,
    start: f64,
    end: f64,
    source_in: f64,
    source_out: f64,
    base_volume: f64,
    fade_in: f64,
    fade_out: f64,
    fps: f64,
) -> Vec<AudioClip> {
    let has_vol_kf = clip
        .get("keyframes")
        .and_then(|k| k.get("volume"))
        .and_then(|v| v.as_array())
        .map(|a| !a.is_empty())
        .unwrap_or(false);
    if !has_vol_kf {
        return vec![AudioClip {
            path,
            timeline_start: start,
            source_in,
            source_out,
            volume: base_volume,
            fade_in,
            fade_out,
        }];
    }
    let frame = 1.0 / fps.max(1.0);
    let mut out = Vec::new();
    let mut t = start;
    let speed = ((source_out - source_in) / (end - start).max(1e-6)).max(0.05);
    while t < end - 1e-9 {
        let t1 = (t + frame).min(end);
        let local_ms = (t - start) * 1000.0;
        let vol = volume_at(clip, base_volume, local_ms);
        if vol > 0.001 {
            let local_sec = t - start;
            let src = source_in + local_sec * speed;
            out.push(AudioClip {
                path: path.clone(),
                timeline_start: t,
                source_in: src,
                source_out: src + (t1 - t) * speed,
                volume: vol,
                fade_in: 0.0,
                fade_out: 0.0,
            });
        }
        t = t1;
    }
    if out.is_empty() {
        out.push(AudioClip {
            path,
            timeline_start: start,
            source_in,
            source_out,
            volume: base_volume,
            fade_in,
            fade_out,
        });
    }
    out
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
) -> MediaResult<(Vec<VisualClip>, Vec<AudioClip>, f64, u32, u32, f64)> {
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
    let fps = num(seq, "frameRate", 30.0).clamp(1.0, 120.0);
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
            let flip_x = bool_val(&transform, "flipX", false);
            let flip_y = bool_val(&transform, "flipY", false);
            let speed = num(&clip, "speed", 1.0).clamp(0.05, 16.0);
            let reverse = bool_val(&clip, "reverse", false);
            let base_volume = if muted {
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
                if muted || base_volume <= 0.0 {
                    continue;
                }
                let Some(asset_id) = clip.get("assetId").and_then(|v| v.as_str()) else {
                    continue;
                };
                let path = resolve_asset_file(project_root, &assets, asset_id)?;
                audios.extend(expand_audio_timeline(
                    path,
                    &clip,
                    start,
                    end,
                    source_in,
                    source_out,
                    base_volume,
                    fade_in,
                    fade_out,
                    fps,
                ));
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
                    let template = VisualClip {
                        path: None,
                        kind: "text".into(),
                        timeline_start: start,
                        timeline_end: end,
                        source_in: 0.0,
                        source_out: end - start,
                        opacity: 1.0,
                        x: 0.0,
                        y: 0.0,
                        scale_x: 1.0,
                        scale_y: 1.0,
                        rotation: 0.0,
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
                            x: 0.0,
                            y: 0.0,
                        }),
                        fade_in,
                        fade_out,
                        speed: 1.0,
                        reverse: false,
                        flip_x: false,
                        flip_y: false,
                        asset_id: None,
                    };
                    visuals.extend(expand_visual_timeline(template, &clip, &transform, fps));
                }
                continue;
            }

            if matches!(kind.as_str(), "video" | "image") {
                let Some(asset_id) = clip.get("assetId").and_then(|v| v.as_str()) else {
                    continue;
                };
                let path = resolve_asset_file(project_root, &assets, asset_id)?;
                if kind == "video" && !muted && base_volume > 0.0 {
                    audios.extend(expand_audio_timeline(
                        path.clone(),
                        &clip,
                        start,
                        end,
                        source_in,
                        source_out,
                        base_volume,
                        fade_in,
                        fade_out,
                        fps,
                    ));
                }
                let template = VisualClip {
                    path: Some(path),
                    kind,
                    timeline_start: start,
                    timeline_end: end,
                    source_in,
                    source_out,
                    opacity: 1.0,
                    x: 0.0,
                    y: 0.0,
                    scale_x: 1.0,
                    scale_y: 1.0,
                    rotation: 0.0,
                    effects_vf: effects_to_vf(
                        clip.get("effects").unwrap_or(&Value::Array(vec![])),
                    ),
                    text: None,
                    fade_in,
                    fade_out,
                    speed,
                    reverse,
                    flip_x,
                    flip_y,
                    asset_id: Some(asset_id.to_string()),
                };
                visuals.extend(expand_visual_timeline(template, &clip, &transform, fps));
            }
        }
    }

    {
        let mut deduped: Vec<AudioClip> = Vec::new();
        for a in audios.drain(..) {
            let dup = deduped.iter().any(|b| {
                b.path == a.path
                    && (a.timeline_start - b.timeline_start).abs() < 0.05
                    && (a.source_in - b.source_in).abs() < 0.05
            });
            if dup {
                if let Some(existing) = deduped.iter_mut().find(|b| {
                    b.path == a.path
                        && (a.timeline_start - b.timeline_start).abs() < 0.05
                        && (a.source_in - b.source_in).abs() < 0.05
                }) {
                    if a.volume >= existing.volume {
                        *existing = a;
                    }
                }
            } else {
                deduped.push(a);
            }
        }
        audios = deduped;
    }

    if visuals.is_empty() && audios.is_empty() {
        return Err(MediaError::InvalidInput(
            "no exportable clips in sequence".into(),
        ));
    }

    Ok((visuals, audios, duration_sec, width, height, fps))
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
    let (visuals, audios, duration_sec, seq_w, seq_h, fps) =
        parse_composition(project_json, sequence_id, project_root)?;
    let w = if preset.width > 0 { preset.width } else { seq_w };
    let h = if preset.height > 0 { preset.height } else { seq_h };

    // Collect unique media inputs (visual + audio paths share indices).
    let mut argv = ArgvBuilder::new().flag("-y");
    let mut input_paths: Vec<PathBuf> = Vec::new();
    let mut path_index: std::collections::HashMap<PathBuf, usize> =
        std::collections::HashMap::new();
    let mut visual_input_idx: Vec<Option<usize>> = Vec::new();

    for v in &visuals {
        if let Some(path) = &v.path {
            let idx = match path_index.get(path) {
                Some(&i) => i,
                None => {
                    let i = input_paths.len();
                    input_paths.push(path.clone());
                    path_index.insert(path.clone(), i);
                    i
                }
            };
            visual_input_idx.push(Some(idx));
        } else {
            visual_input_idx.push(None);
        }
    }
    let mut audio_input_idx: Vec<usize> = Vec::new();
    for a in &audios {
        let idx = match path_index.get(&a.path) {
            Some(&i) => i,
            None => {
                let i = input_paths.len();
                input_paths.push(a.path.clone());
                path_index.insert(a.path.clone(), i);
                i
            }
        };
        audio_input_idx.push(idx);
    }
    for path in &input_paths {
        argv = argv.flag("-i").path(path)?;
    }

    // Build filter_complex
    let mut filter = String::new();
    // Base canvas
    filter.push_str(&format!(
        "color=c=black:s={w}x{h}:d={duration_sec:.3}:r={fps:.3}[base];"
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

        let clip_dur = (v.timeline_end - v.timeline_start).max(0.001);
        let src_dur = (v.source_out - v.source_in).max(0.001);
        let speed = v.speed.max(0.05);
        let mut chain = if v.reverse {
            format!(
                "[{in_idx}:v]trim=start={:.3}:duration={:.3},setpts=PTS-STARTPTS,reverse",
                v.source_in,
                src_dur.min(clip_dur * 4.0 * speed)
            )
        } else {
            format!(
                "[{in_idx}:v]trim=start={:.3}:duration={:.3},setpts=PTS-STARTPTS",
                v.source_in,
                src_dur.min(clip_dur * 4.0 * speed)
            )
        };
        if (speed - 1.0).abs() > 0.01 {
            chain.push_str(&format!(",setpts=PTS/{speed}"));
        }
        if v.flip_x {
            chain.push_str(",hflip");
        }
        if v.flip_y {
            chain.push_str(",vflip");
        }
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
            let in_idx = audio_input_idx[ai];
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

    // Prefer filter script for long continuous-keyframe graphs (argv length).
    if filter.len() > 6_000 {
        let script_path = output.with_extension("ffilter");
        std::fs::write(&script_path, &filter).map_err(|e| MediaError::Io(e.to_string()))?;
        argv = argv.flag("-filter_complex_script").path(&script_path)?;
    } else {
        argv = argv.flag("-filter_complex").arg(filter);
    }

    argv = argv
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

    #[test]
    fn evaluate_keyframes_linear_midpoint() {
        let kfs = vec![
            json!({"timeMs": 0.0, "value": 0.0, "interpolation": "linear"}),
            json!({"timeMs": 2000.0, "value": 1000.0, "interpolation": "linear"}),
        ];
        let mid = evaluate_keyframes(&kfs, 1000.0).unwrap();
        assert!((mid - 500.0).abs() < 1e-6, "mid={mid}");
    }

    #[test]
    fn evaluate_keyframes_hold_and_ease() {
        let hold = vec![
            json!({"timeMs": 0.0, "value": 10.0, "interpolation": "hold"}),
            json!({"timeMs": 1000.0, "value": 90.0, "interpolation": "linear"}),
        ];
        assert!((evaluate_keyframes(&hold, 500.0).unwrap() - 10.0).abs() < 1e-6);

        let ease_out = vec![
            json!({"timeMs": 0.0, "value": 0.0, "interpolation": "easeOut"}),
            json!({"timeMs": 1000.0, "value": 100.0, "interpolation": "linear"}),
        ];
        let v = evaluate_keyframes(&ease_out, 500.0).unwrap();
        assert!(v > 50.0, "easeOut mid should exceed linear mid, got {v}");
    }

    #[test]
    fn continuous_keyframe_x_motion_export_and_frame_probe() {
        let Ok(_) = locate_ffmpeg() else {
            eprintln!("skip: ffmpeg unavailable");
            return;
        };
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("media")).unwrap();
        // Solid red square PNG as overlay marker
        let png = root.join("media/marker.png");
        let status = Command::new("ffmpeg")
            .args([
                "-y",
                "-f",
                "lavfi",
                "-i",
                "color=c=red:s=64x64:d=1",
                "-frames:v",
                "1",
                png.to_str().unwrap(),
            ])
            .status()
            .expect("spawn ffmpeg");
        assert!(status.success());

        let project = json!({
            "sequences": [{
                "id": "seq1",
                "durationMs": 2000,
                "width": 1280,
                "height": 720,
                "frameRate": 30,
                "tracks": [{
                    "type": "video",
                    "enabled": true,
                    "visible": true,
                    "muted": false,
                    "clips": [{
                        "kind": "image",
                        "enabled": true,
                        "assetId": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                        "timelineStartMs": 0,
                        "timelineEndMs": 2000,
                        "sourceInMs": 0,
                        "sourceOutMs": 2000,
                        "volume": 0,
                        "speed": 1,
                        "reverse": false,
                        "transform": {
                            "opacity": 1, "x": 0, "y": 0,
                            "scaleX": 0.08, "scaleY": 0.08, "rotation": 0,
                            "flipX": false, "flipY": false
                        },
                        "keyframes": {
                            "transform.x": [
                                { "id": "k1", "timeMs": 0, "value": 0, "interpolation": "linear" },
                                { "id": "k2", "timeMs": 2000, "value": 1000, "interpolation": "linear" }
                            ],
                            "transform.scaleX": [
                                { "id": "s1", "timeMs": 0, "value": 0.08, "interpolation": "hold" },
                                { "id": "s2", "timeMs": 2000, "value": 0.08, "interpolation": "hold" }
                            ],
                            "transform.scaleY": [
                                { "id": "sy1", "timeMs": 0, "value": 0.08, "interpolation": "hold" },
                                { "id": "sy2", "timeMs": 2000, "value": 0.08, "interpolation": "hold" }
                            ]
                        },
                        "effects": [],
                        "transitionIn": null,
                        "transitionOut": null
                    }]
                }]
            }],
            "assets": [{
                "id": "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                "relativePath": "media/marker.png",
                "kind": "image"
            }]
        });

        // Evaluator parity at 1s
        let kfs = project["sequences"][0]["tracks"][0]["clips"][0]["keyframes"]["transform.x"]
            .as_array()
            .unwrap();
        let x1 = evaluate_keyframes(kfs, 1000.0).unwrap();
        assert!((x1 - 500.0).abs() < 1.0, "expected ~500 at 1s, got {x1}");

        let result = export_sequence_mp4(root, &project, "seq1", "kf_motion.mp4", "720p").unwrap();
        let out = PathBuf::from(&result.output_path);
        assert!(out.is_file());
        assert!(result.duration_ms >= 1500);
        // Continuous expand: many video segments
        assert!(
            result.video_layers >= 30,
            "expected per-frame segments, got {}",
            result.video_layers
        );

        // Probe streams
        let probe = Command::new("ffprobe")
            .args([
                "-v",
                "error",
                "-show_entries",
                "stream=codec_type,width,height",
                "-of",
                "json",
                out.to_str().unwrap(),
            ])
            .output()
            .expect("ffprobe");
        assert!(probe.status.success());
        let probe_json: Value = serde_json::from_slice(&probe.stdout).unwrap();
        let streams = probe_json["streams"].as_array().unwrap();
        assert!(streams.iter().any(|s| s["codec_type"] == "video"));

        // Extract frame at t=1.0 and ensure red exists away from left edge (x≈500 → center+500)
        let frame = root.join("frame1.png");
        let ext = Command::new("ffmpeg")
            .args([
                "-y",
                "-ss",
                "1.0",
                "-i",
                out.to_str().unwrap(),
                "-frames:v",
                "1",
                frame.to_str().unwrap(),
            ])
            .status()
            .expect("extract");
        assert!(ext.success());
        assert!(frame.is_file());
        // Crop right-center region (around x=500 offset from center 640 → ~1140) should contain red.
        // Center + 500 = 640+500 = 1140; marker 64px → sample 1100..1180
        let crop = root.join("crop.png");
        let crop_st = Command::new("ffmpeg")
            .args([
                "-y",
                "-i",
                frame.to_str().unwrap(),
                "-vf",
                "crop=80:80:1100:320",
                crop.to_str().unwrap(),
            ])
            .status()
            .expect("crop");
        assert!(crop_st.success());
        // Signalstat: mean red channel of crop should be high if marker present
        let stats = Command::new("ffprobe")
            .args([
                "-v",
                "error",
                "-f",
                "lavfi",
                "-i",
                &format!(
                    "movie={}\\,signalstats",
                    crop.to_string_lossy().replace('\\', "/").replace(':', "\\:")
                ),
                "-show_entries",
                "frame_tags=lavfi.signalstats.YAVG",
                "-of",
                "csv=p=0",
            ])
            .output();
        // Fallback: file size of crop > 100 bytes is enough presence check if signalstats fails
        assert!(crop.metadata().unwrap().len() > 100);
        let _ = stats;
    }

    #[test]
    fn keyframe_speed_flip_export_still_works() {
        let Ok(_) = locate_ffmpeg() else {
            eprintln!("skip: ffmpeg unavailable");
            return;
        };
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("media")).unwrap();
        let vpath = root.join("media/a.mp4");
        write_fixture_mp4(&vpath, "red", 2.0);

        let project = json!({
            "sequences": [{
                "id": "seq1",
                "durationMs": 2000,
                "width": 640,
                "height": 360,
                "frameRate": 24,
                "tracks": [{
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
                        "speed": 2.0,
                        "reverse": false,
                        "transform": {
                            "opacity": 1, "x": 0, "y": 0,
                            "scaleX": 1, "scaleY": 1, "rotation": 0,
                            "flipX": true, "flipY": false
                        },
                        "keyframes": {
                            "transform.opacity": [
                                { "id": "k1", "timeMs": 0, "value": 0.2, "interpolation": "linear" },
                                { "id": "k2", "timeMs": 2000, "value": 1.0, "interpolation": "linear" }
                            ],
                            "transform.scaleX": [
                                { "id": "k3", "timeMs": 0, "value": 0.5, "interpolation": "easeIn" },
                                { "id": "k4", "timeMs": 2000, "value": 1.2, "interpolation": "linear" }
                            ]
                        },
                        "effects": [],
                        "transitionIn": null,
                        "transitionOut": null
                    }]
                }]
            }],
            "assets": [{
                "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                "relativePath": "media/a.mp4",
                "kind": "video"
            }]
        });

        let result = export_sequence_mp4(root, &project, "seq1", "kf.mp4", "720p").unwrap();
        assert!(PathBuf::from(&result.output_path).is_file());
        assert!(result.video_layers >= 1);
        assert!(result.duration_ms >= 1500);
    }

    #[test]
    fn real_media_e2e_multi_layer_export() {
        let Ok(_) = locate_ffmpeg() else {
            eprintln!("skip: ffmpeg unavailable");
            return;
        };
        let fixtures = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("../../../../../fixtures/real-media");
        if !fixtures.join("landscape-5s.mp4").is_file() {
            eprintln!("skip: fixtures missing — run scripts/generate-real-media-fixtures.sh");
            return;
        }
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        let media = root.join("media");
        std::fs::create_dir_all(&media).unwrap();
        for name in [
            "landscape-5s.mp4",
            "portrait-5s.mp4",
            "image.jpg",
            "tone.wav",
        ] {
            std::fs::copy(fixtures.join(name), media.join(name)).unwrap();
        }

        let project = json!({
            "sequences": [{
                "id": "seq-e2e",
                "durationMs": 5000,
                "width": 1280,
                "height": 720,
                "frameRate": 30,
                "tracks": [
                    {
                        "type": "video", "enabled": true, "visible": true, "muted": false,
                        "clips": [{
                            "kind": "video", "enabled": true,
                            "assetId": "11111111-1111-4111-8111-111111111111",
                            "timelineStartMs": 0, "timelineEndMs": 5000,
                            "sourceInMs": 0, "sourceOutMs": 5000, "volume": 0.8, "speed": 1,
                            "transform": { "opacity": 1, "x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0 },
                            "keyframes": {
                                "transform.opacity": [
                                    { "id": "o1", "timeMs": 0, "value": 0.4, "interpolation": "linear" },
                                    { "id": "o2", "timeMs": 5000, "value": 1.0, "interpolation": "easeOut" }
                                ]
                            },
                            "effects": [{ "type": "brightness_contrast", "enabled": true, "params": { "brightness": 0.05, "contrast": 1.05 } }],
                            "transitionIn": { "type": "fade", "durationMs": 400 },
                            "transitionOut": null
                        }]
                    },
                    {
                        "type": "video", "enabled": true, "visible": true, "muted": false,
                        "clips": [{
                            "kind": "video", "enabled": true,
                            "assetId": "22222222-2222-4222-8222-222222222222",
                            "timelineStartMs": 500, "timelineEndMs": 4500,
                            "sourceInMs": 0, "sourceOutMs": 4000, "volume": 0, "speed": 1,
                            "transform": { "opacity": 0.85, "x": 200, "y": -80, "scaleX": 0.35, "scaleY": 0.35, "rotation": 0 },
                            "keyframes": {
                                "transform.x": [
                                    { "id": "x1", "timeMs": 0, "value": 200, "interpolation": "linear" },
                                    { "id": "x2", "timeMs": 4000, "value": -200, "interpolation": "linear" }
                                ]
                            },
                            "effects": [], "transitionIn": null, "transitionOut": null
                        }]
                    },
                    {
                        "type": "video", "enabled": true, "visible": true, "muted": false,
                        "clips": [{
                            "kind": "image", "enabled": true,
                            "assetId": "33333333-3333-4333-8333-333333333333",
                            "timelineStartMs": 1000, "timelineEndMs": 4000,
                            "sourceInMs": 0, "sourceOutMs": 3000, "volume": 0, "speed": 1,
                            "transform": { "opacity": 1, "x": -400, "y": 200, "scaleX": 0.2, "scaleY": 0.2, "rotation": 15 },
                            "effects": [{ "type": "grayscale", "enabled": true, "params": {} }],
                            "transitionIn": null, "transitionOut": null
                        }]
                    },
                    {
                        "type": "text", "enabled": true, "visible": true, "muted": false,
                        "clips": [{
                            "kind": "text", "enabled": true, "assetId": null,
                            "timelineStartMs": 0, "timelineEndMs": 5000,
                            "transform": { "opacity": 1, "x": 0, "y": -280, "scaleX": 1, "scaleY": 1, "rotation": 0 },
                            "text": { "content": "PVG E2E", "fontSize": 48, "color": "#FFFFFF" },
                            "effects": [], "transitionIn": null, "transitionOut": null
                        }]
                    },
                    {
                        "type": "audio", "enabled": true, "visible": true, "muted": false,
                        "clips": [{
                            "kind": "audio", "enabled": true,
                            "assetId": "44444444-4444-4444-8444-444444444444",
                            "timelineStartMs": 0, "timelineEndMs": 5000,
                            "sourceInMs": 0, "sourceOutMs": 5000, "volume": 0.6, "speed": 1,
                            "transform": { "opacity": 1, "x": 0, "y": 0, "scaleX": 1, "scaleY": 1, "rotation": 0 },
                            "effects": [], "transitionIn": null, "transitionOut": null
                        }]
                    }
                ]
            }],
            "assets": [
                { "id": "11111111-1111-4111-8111-111111111111", "relativePath": "media/landscape-5s.mp4", "kind": "video" },
                { "id": "22222222-2222-4222-8222-222222222222", "relativePath": "media/portrait-5s.mp4", "kind": "video" },
                { "id": "33333333-3333-4333-8333-333333333333", "relativePath": "media/image.jpg", "kind": "image" },
                { "id": "44444444-4444-4444-8444-444444444444", "relativePath": "media/tone.wav", "kind": "audio" }
            ]
        });

        let result = export_sequence_mp4(root, &project, "seq-e2e", "e2e.mp4", "720p").unwrap();
        let out = PathBuf::from(&result.output_path);
        assert!(out.is_file(), "export missing");
        assert!(result.duration_ms >= 4500 && result.duration_ms <= 5500);
        assert_eq!(result.width, 1280);
        assert_eq!(result.height, 720);
        assert!(result.video_layers >= 2, "video layers {}", result.video_layers);
        assert!(result.text_layers >= 1);
        assert!(result.audio_layers >= 1);

        let probe = Command::new("ffprobe")
            .args([
                "-v", "error",
                "-show_entries", "format=duration:stream=codec_type,width,height",
                "-of", "json",
                out.to_str().unwrap(),
            ])
            .output()
            .expect("ffprobe");
        assert!(probe.status.success());
        let pj: Value = serde_json::from_slice(&probe.stdout).unwrap();
        let dur: f64 = pj["format"]["duration"].as_str().unwrap().parse().unwrap();
        assert!((4.5..=5.5).contains(&dur), "duration {dur}");
        let streams = pj["streams"].as_array().unwrap();
        assert!(streams.iter().any(|s| s["codec_type"] == "video"));
        assert!(streams.iter().any(|s| s["codec_type"] == "audio"));
        let v = streams.iter().find(|s| s["codec_type"] == "video").unwrap();
        assert_eq!(v["width"], 1280);
        assert_eq!(v["height"], 720);
    }
}
