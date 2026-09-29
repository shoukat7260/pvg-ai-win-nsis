/**
 * Adapted from OpenCut Classic (MIT)
 * vendor/opencut-classic/apps/web/src/timeline/ruler-utils.ts
 */
import { BASE_TIMELINE_PIXELS_PER_SECOND } from "./scale.js";

const LABEL_FRAME_INTERVALS = [2, 3, 5, 10, 15] as const;
const TICK_FRAME_INTERVALS = [1, 2, 3, 5, 10, 15] as const;
const SECOND_MULTIPLIERS = [
  1, 2, 3, 5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600,
] as const;

const MIN_LABEL_SPACING_PX = 120;
const MIN_TICK_SPACING_PX = 18;

export interface RulerConfig {
  labelIntervalSeconds: number;
  tickIntervalSeconds: number;
}

export function getRulerConfig({
  zoomLevel,
  fps,
}: {
  zoomLevel: number;
  fps: number;
}): RulerConfig {
  const fpsFloat = Math.max(fps, 1);
  const pixelsPerSecond = BASE_TIMELINE_PIXELS_PER_SECOND * zoomLevel;
  const pixelsPerFrame = pixelsPerSecond / fpsFloat;

  const labelIntervalSeconds = findOptimalInterval({
    pixelsPerFrame,
    pixelsPerSecond,
    fps: fpsFloat,
    minSpacingPx: MIN_LABEL_SPACING_PX,
    frameIntervals: LABEL_FRAME_INTERVALS,
  });

  const rawTickIntervalSeconds = findOptimalInterval({
    pixelsPerFrame,
    pixelsPerSecond,
    fps: fpsFloat,
    minSpacingPx: MIN_TICK_SPACING_PX,
    frameIntervals: TICK_FRAME_INTERVALS,
  });

  const tickIntervalSeconds = ensureTickDividesLabel({
    tickIntervalSeconds: rawTickIntervalSeconds,
    labelIntervalSeconds,
    pixelsPerFrame,
    pixelsPerSecond,
    fps: fpsFloat,
  });

  return { labelIntervalSeconds, tickIntervalSeconds };
}

function ensureTickDividesLabel(args: {
  tickIntervalSeconds: number;
  labelIntervalSeconds: number;
  pixelsPerFrame: number;
  pixelsPerSecond: number;
  fps: number;
}): number {
  const { tickIntervalSeconds, labelIntervalSeconds, pixelsPerFrame, pixelsPerSecond, fps } =
    args;
  const labelFrames = Math.round(labelIntervalSeconds * fps);
  const tickFrames = Math.round(tickIntervalSeconds * fps);
  if (labelFrames % tickFrames === 0) return tickIntervalSeconds;

  for (const candidateFrames of TICK_FRAME_INTERVALS) {
    if (labelFrames % candidateFrames === 0) {
      const candidateSpacing = pixelsPerFrame * candidateFrames;
      if (candidateSpacing >= MIN_TICK_SPACING_PX) {
        return candidateFrames / fps;
      }
    }
  }

  for (const candidateSeconds of SECOND_MULTIPLIERS) {
    const ratio = labelIntervalSeconds / candidateSeconds;
    const isDivisor = Math.abs(ratio - Math.round(ratio)) < 0.0001;
    if (isDivisor) {
      const candidateSpacing = pixelsPerSecond * candidateSeconds;
      if (candidateSpacing >= MIN_TICK_SPACING_PX) return candidateSeconds;
    }
  }

  return labelIntervalSeconds;
}

function findOptimalInterval(args: {
  pixelsPerFrame: number;
  pixelsPerSecond: number;
  fps: number;
  minSpacingPx: number;
  frameIntervals: readonly number[];
}): number {
  const { pixelsPerFrame, pixelsPerSecond, fps, minSpacingPx, frameIntervals } = args;
  for (const frameInterval of frameIntervals) {
    const pixelSpacing = pixelsPerFrame * frameInterval;
    if (pixelSpacing >= minSpacingPx) return frameInterval / fps;
  }
  for (const secondMultiplier of SECOND_MULTIPLIERS) {
    const pixelSpacing = pixelsPerSecond * secondMultiplier;
    if (pixelSpacing >= minSpacingPx) return secondMultiplier;
  }
  return 60;
}

export function shouldShowLabel({
  timeSeconds,
  labelIntervalSeconds,
}: {
  timeSeconds: number;
  labelIntervalSeconds: number;
}): boolean {
  const epsilon = 0.0001;
  const remainder = timeSeconds % labelIntervalSeconds;
  return remainder < epsilon || remainder > labelIntervalSeconds - epsilon;
}

export function formatRulerLabel({
  timeInSeconds,
  fps,
}: {
  timeInSeconds: number;
  fps: number;
}): string {
  if (isSecondBoundary(timeInSeconds)) {
    return formatTimestamp(timeInSeconds);
  }
  const frameWithinSecond = Math.round((timeInSeconds % 1) * fps);
  return `${frameWithinSecond}f`;
}

function isSecondBoundary(timeInSeconds: number): boolean {
  const epsilon = 0.0001;
  const remainder = timeInSeconds % 1;
  return remainder < epsilon || remainder > 1 - epsilon;
}

function formatTimestamp(timeInSeconds: number): string {
  const totalSeconds = Math.round(timeInSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = minutes.toString().padStart(2, "0");
  const ss = seconds.toString().padStart(2, "0");
  if (hours > 0) return `${hours}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

/** Build tick positions in milliseconds for rendering. */
export function buildRulerTicksMs(args: {
  durationMs: number;
  zoomLevel: number;
  fps: number;
}): Array<{ timeMs: number; kind: "label" | "tick" }> {
  const { durationMs, zoomLevel, fps } = args;
  const config = getRulerConfig({ zoomLevel, fps });
  const durationSec = durationMs / 1000;
  const out: Array<{ timeMs: number; kind: "label" | "tick" }> = [];
  const epsilon = 0.000001;
  for (let t = 0; t <= durationSec + epsilon; t += config.tickIntervalSeconds) {
    const timeMs = Math.round(t * 1000);
    const isLabel = shouldShowLabel({
      timeSeconds: t,
      labelIntervalSeconds: config.labelIntervalSeconds,
    });
    out.push({ timeMs, kind: isLabel ? "label" : "tick" });
  }
  return out;
}
