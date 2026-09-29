import type { Clip, Sequence } from "@pvg/project-format";
import { EditorError, assertFinite } from "../errors.js";
import { newId } from "../ids.js";
import { findClip, recomputeSequenceDuration } from "./find.js";

/** Split clip at absolute timeline time. Returns new right-half clip id. */
export function splitClipAt(
  sequence: Sequence,
  clipId: string,
  atMs: number,
): { sequence: Sequence; rightClipId: string } {
  assertFinite(atMs, "atMs");
  const next = structuredClone(sequence);
  const loc = findClip(next, clipId);
  if (loc.track.locked) {
    throw new EditorError("EDIT_OPERATION_FAILED", "Track is locked");
  }
  const clip = loc.clip;
  const end = clip.timelineEndMs ?? clip.timelineStartMs;
  if (atMs <= clip.timelineStartMs || atMs >= end) {
    throw new EditorError("INVALID_TIME_RANGE", "Split point outside clip", {
      atMs,
      start: clip.timelineStartMs,
      end,
    });
  }

  const ratio =
    (atMs - clip.timelineStartMs) / Math.max(1, end - clip.timelineStartMs);
  const srcSpan =
    (clip.sourceOutMs ?? clip.sourceInMs) - clip.sourceInMs;
  const splitSource = clip.sourceInMs + srcSpan * ratio;

  const right: Clip = {
    ...structuredClone(clip),
    id: newId(),
    timelineStartMs: atMs,
    timelineEndMs: end,
    sourceInMs: splitSource,
    sourceOutMs: clip.sourceOutMs,
    linkedClipId: null,
    groupId: clip.groupId,
  };

  clip.timelineEndMs = atMs;
  clip.sourceOutMs = splitSource;

  loc.track.clips.splice(loc.clipIndex + 1, 0, right);
  recomputeSequenceDuration(next);
  return { sequence: next, rightClipId: right.id };
}

export function splitClipsAtPlayhead(
  sequence: Sequence,
  clipIds: string[],
  playheadMs: number,
): Sequence {
  let current = sequence;
  for (const id of clipIds) {
    try {
      const result = splitClipAt(current, id, playheadMs);
      current = result.sequence;
    } catch (e) {
      if (e instanceof EditorError && e.code === "INVALID_TIME_RANGE") {
        continue;
      }
      throw e;
    }
  }
  return current;
}
