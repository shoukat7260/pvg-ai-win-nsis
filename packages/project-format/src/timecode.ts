/**
 * Frame-accurate time helpers.
 * Floating-point seconds are for display only — prefer integer ms + fps.
 */

export function framesToMs(frames: number, fps: number): number {
  if (fps <= 0) throw new Error("fps must be positive");
  return Math.round((frames * 1000) / fps);
}

export function msToFrames(ms: number, fps: number): number {
  if (fps <= 0) throw new Error("fps must be positive");
  return Math.round((ms * fps) / 1000);
}

/** Non-drop-frame HH:MM:SS:FF */
export function formatTimecode(ms: number, fps: number): string {
  if (fps <= 0) throw new Error("fps must be positive");
  const totalFrames = Math.max(0, msToFrames(ms, fps));
  const ff = totalFrames % Math.round(fps);
  const totalSeconds = Math.floor(totalFrames / Math.round(fps));
  const ss = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const mm = totalMinutes % 60;
  const hh = Math.floor(totalMinutes / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hh)}:${pad(mm)}:${pad(ss)}:${pad(ff)}`;
}

export function parseTimecode(tc: string, fps: number): number {
  if (fps <= 0) throw new Error("fps must be positive");
  const m = /^(\d{2}):(\d{2}):(\d{2}):(\d{2})$/.exec(tc.trim());
  if (!m) throw new Error("invalid timecode");
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  const ss = Number(m[3]);
  const ff = Number(m[4]);
  const roundedFps = Math.round(fps);
  const totalFrames = ((hh * 60 + mm) * 60 + ss) * roundedFps + ff;
  return framesToMs(totalFrames, fps);
}
