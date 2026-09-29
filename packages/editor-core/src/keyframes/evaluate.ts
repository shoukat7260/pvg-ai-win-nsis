import type { Keyframe } from "@pvg/project-format";
import { EditorError, assertFinite } from "../errors.js";

function clamp01(t: number): number {
  return Math.min(1, Math.max(0, t));
}

function easeIn(t: number): number {
  return t * t;
}

function easeOut(t: number): number {
  return 1 - (1 - t) * (1 - t);
}

/** Cubic Bezier approx using handles (normalized). */
function bezierT(
  t: number,
  outHandle: [number, number] | null | undefined,
  inHandle: [number, number] | null | undefined,
): number {
  const p1 = outHandle ?? [0.33, 0];
  const p2 = inHandle ?? [0.66, 1];
  const u = 1 - t;
  // y component of cubic bezier with P0=(0,0) P3=(1,1)
  return (
    3 * u * u * t * p1[1] +
    3 * u * t * t * p2[1] +
    t * t * t
  );
}

export function interpolateNumber(
  a: Keyframe,
  b: Keyframe,
  timeMs: number,
): number {
  assertFinite(timeMs, "timeMs");
  if (typeof a.value !== "number" || typeof b.value !== "number") {
    throw new EditorError("KEYFRAME_INVALID", "Numeric interpolation required");
  }
  if (timeMs <= a.timeMs) return a.value;
  if (timeMs >= b.timeMs) return b.value;
  if (a.interpolation === "hold") return a.value;

  const span = Math.max(1e-9, b.timeMs - a.timeMs);
  let t = clamp01((timeMs - a.timeMs) / span);

  switch (a.interpolation) {
    case "easeIn":
      t = easeIn(t);
      break;
    case "easeOut":
      t = easeOut(t);
      break;
    case "bezier":
      t = bezierT(t, a.outHandle, b.inHandle);
      break;
    case "linear":
    default:
      break;
  }

  return a.value + (b.value - a.value) * t;
}

export function evaluateKeyframes(
  keyframes: Keyframe[],
  timeMs: number,
): number | string | boolean | undefined {
  if (!keyframes.length) return undefined;
  const sorted = [...keyframes].sort((a, b) => a.timeMs - b.timeMs);
  if (timeMs <= sorted[0]!.timeMs) return sorted[0]!.value;
  if (timeMs >= sorted[sorted.length - 1]!.timeMs) {
    return sorted[sorted.length - 1]!.value;
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (timeMs >= a.timeMs && timeMs <= b.timeMs) {
      if (typeof a.value === "number" && typeof b.value === "number") {
        return interpolateNumber(a, b, timeMs);
      }
      return a.interpolation === "hold" ? a.value : b.value;
    }
  }
  return sorted[0]!.value;
}

export function evaluateTransformProperty(
  base: number,
  keyframes: Keyframe[] | undefined,
  localTimeMs: number,
): number {
  if (!keyframes?.length) return base;
  const v = evaluateKeyframes(keyframes, localTimeMs);
  return typeof v === "number" ? v : base;
}

export type MotionPresetId =
  | "fadeIn"
  | "fadeOut"
  | "slideIn"
  | "slideOut"
  | "zoomIn"
  | "zoomOut"
  | "pop"
  | "simpleMove";

export interface MotionPresetResult {
  propertyPath: string;
  keyframes: Omit<Keyframe, "id">[];
}

export function motionPreset(
  id: MotionPresetId,
  durationMs: number,
): MotionPresetResult[] {
  const d = Math.max(1, durationMs);
  switch (id) {
    case "fadeIn":
      return [
        {
          propertyPath: "transform.opacity",
          keyframes: [
            { timeMs: 0, value: 0, interpolation: "easeOut", inHandle: null, outHandle: null },
            { timeMs: d, value: 1, interpolation: "linear", inHandle: null, outHandle: null },
          ],
        },
      ];
    case "fadeOut":
      return [
        {
          propertyPath: "transform.opacity",
          keyframes: [
            { timeMs: 0, value: 1, interpolation: "easeIn", inHandle: null, outHandle: null },
            { timeMs: d, value: 0, interpolation: "linear", inHandle: null, outHandle: null },
          ],
        },
      ];
    case "slideIn":
      return [
        {
          propertyPath: "transform.x",
          keyframes: [
            { timeMs: 0, value: -200, interpolation: "easeOut", inHandle: null, outHandle: null },
            { timeMs: d, value: 0, interpolation: "linear", inHandle: null, outHandle: null },
          ],
        },
      ];
    case "slideOut":
      return [
        {
          propertyPath: "transform.x",
          keyframes: [
            { timeMs: 0, value: 0, interpolation: "easeIn", inHandle: null, outHandle: null },
            { timeMs: d, value: 200, interpolation: "linear", inHandle: null, outHandle: null },
          ],
        },
      ];
    case "zoomIn":
      return [
        {
          propertyPath: "transform.scaleX",
          keyframes: [
            { timeMs: 0, value: 0.5, interpolation: "easeOut", inHandle: null, outHandle: null },
            { timeMs: d, value: 1, interpolation: "linear", inHandle: null, outHandle: null },
          ],
        },
        {
          propertyPath: "transform.scaleY",
          keyframes: [
            { timeMs: 0, value: 0.5, interpolation: "easeOut", inHandle: null, outHandle: null },
            { timeMs: d, value: 1, interpolation: "linear", inHandle: null, outHandle: null },
          ],
        },
      ];
    case "zoomOut":
      return [
        {
          propertyPath: "transform.scaleX",
          keyframes: [
            { timeMs: 0, value: 1, interpolation: "easeIn", inHandle: null, outHandle: null },
            { timeMs: d, value: 1.5, interpolation: "linear", inHandle: null, outHandle: null },
          ],
        },
        {
          propertyPath: "transform.scaleY",
          keyframes: [
            { timeMs: 0, value: 1, interpolation: "easeIn", inHandle: null, outHandle: null },
            { timeMs: d, value: 1.5, interpolation: "linear", inHandle: null, outHandle: null },
          ],
        },
      ];
    case "pop":
      return [
        {
          propertyPath: "transform.scaleX",
          keyframes: [
            { timeMs: 0, value: 0.2, interpolation: "easeOut", inHandle: null, outHandle: null },
            { timeMs: d * 0.6, value: 1.1, interpolation: "easeIn", inHandle: null, outHandle: null },
            { timeMs: d, value: 1, interpolation: "linear", inHandle: null, outHandle: null },
          ],
        },
        {
          propertyPath: "transform.scaleY",
          keyframes: [
            { timeMs: 0, value: 0.2, interpolation: "easeOut", inHandle: null, outHandle: null },
            { timeMs: d * 0.6, value: 1.1, interpolation: "easeIn", inHandle: null, outHandle: null },
            { timeMs: d, value: 1, interpolation: "linear", inHandle: null, outHandle: null },
          ],
        },
      ];
    case "simpleMove":
      return [
        {
          propertyPath: "transform.x",
          keyframes: [
            { timeMs: 0, value: 0, interpolation: "linear", inHandle: null, outHandle: null },
            { timeMs: d, value: 100, interpolation: "linear", inHandle: null, outHandle: null },
          ],
        },
        {
          propertyPath: "transform.y",
          keyframes: [
            { timeMs: 0, value: 0, interpolation: "linear", inHandle: null, outHandle: null },
            { timeMs: d, value: 40, interpolation: "linear", inHandle: null, outHandle: null },
          ],
        },
      ];
  }
}
