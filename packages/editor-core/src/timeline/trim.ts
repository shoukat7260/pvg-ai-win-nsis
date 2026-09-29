import type { Sequence } from "@pvg/project-format";
import { EditorError, assertFinite } from "../errors.js";
import { findClip, recomputeSequenceDuration, sourceDurationMs } from "./find.js";

export function trimClipLeft(
  sequence: Sequence,
  clipId: string,
  newStartMs: number,
): Sequence {
  assertFinite(newStartMs, "newStartMs");
  const next = structuredClone(sequence);
  const loc = findClip(next, clipId);
  if (loc.track.locked) {
    throw new EditorError("EDIT_OPERATION_FAILED", "Track is locked");
  }
  const clip = loc.clip;
  const end = clip.timelineEndMs ?? clip.timelineStartMs;
  if (newStartMs < 0 || newStartMs >= end) {
    throw new EditorError("INVALID_TIME_RANGE", "Invalid left trim", {
      newStartMs,
      end,
    });
  }
  const delta = newStartMs - clip.timelineStartMs;
  const srcDur = sourceDurationMs(clip);
  const newSourceIn = clip.sourceInMs + delta * (clip.speed || 1);
  if (newSourceIn < 0) {
    throw new EditorError("INVALID_TIME_RANGE", "Trim exceeds source in-point");
  }
  if (clip.sourceOutMs !== null && newSourceIn >= clip.sourceOutMs) {
    throw new EditorError("INVALID_TIME_RANGE", "Trim exceeds source out-point");
  }
  // Also guard against trimming past available source when out is null
  if (srcDur > 0 && newSourceIn > clip.sourceInMs + srcDur) {
    throw new EditorError("INVALID_TIME_RANGE", "Trim exceeds source duration");
  }
  clip.timelineStartMs = newStartMs;
  clip.sourceInMs = Math.max(0, newSourceIn);
  recomputeSequenceDuration(next);
  return next;
}

export function trimClipRight(
  sequence: Sequence,
  clipId: string,
  newEndMs: number,
): Sequence {
  assertFinite(newEndMs, "newEndMs");
  const next = structuredClone(sequence);
  const loc = findClip(next, clipId);
  if (loc.track.locked) {
    throw new EditorError("EDIT_OPERATION_FAILED", "Track is locked");
  }
  const clip = loc.clip;
  if (newEndMs <= clip.timelineStartMs) {
    throw new EditorError("INVALID_TIME_RANGE", "Invalid right trim", {
      newEndMs,
      start: clip.timelineStartMs,
    });
  }
  const delta = newEndMs - (clip.timelineEndMs ?? clip.timelineStartMs);
  if (clip.sourceOutMs !== null) {
    const newSourceOut = clip.sourceOutMs + delta * (clip.speed || 1);
    if (newSourceOut <= clip.sourceInMs) {
      throw new EditorError("INVALID_TIME_RANGE", "Trim collapses source range");
    }
    clip.sourceOutMs = newSourceOut;
  }
  clip.timelineEndMs = newEndMs;
  recomputeSequenceDuration(next);
  return next;
}
