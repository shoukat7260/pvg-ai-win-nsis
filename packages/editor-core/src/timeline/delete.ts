import type { Sequence } from "@pvg/project-format";
import { EditorError } from "../errors.js";
import { findClip, recomputeSequenceDuration } from "./find.js";

export function deleteClips(
  sequence: Sequence,
  clipIds: string[],
): Sequence {
  const next = structuredClone(sequence);
  const idSet = new Set(clipIds);
  for (const id of [...idSet]) {
    try {
      const loc = findClip(next, id);
      if (loc.clip.linkedClipId) idSet.add(loc.clip.linkedClipId);
    } catch {
      /* ignore missing during expansion */
    }
  }
  for (const track of next.tracks) {
    if (track.locked && track.clips.some((c) => idSet.has(c.id))) {
      throw new EditorError("EDIT_OPERATION_FAILED", `Track ${track.name} is locked`);
    }
    track.clips = track.clips.filter((c) => !idSet.has(c.id));
  }
  recomputeSequenceDuration(next);
  return next;
}

/**
 * Ripple delete: remove clips and close the gap on each affected track
 * by shifting following clips left by the removed span.
 */
export function rippleDeleteClips(
  sequence: Sequence,
  clipIds: string[],
): Sequence {
  const next = structuredClone(sequence);
  const idSet = new Set(clipIds);

  // Expand linked
  for (const id of [...idSet]) {
    try {
      const loc = findClip(next, id);
      if (loc.clip.linkedClipId) idSet.add(loc.clip.linkedClipId);
    } catch {
      /* skip */
    }
  }

  for (const track of next.tracks) {
    if (track.locked && track.clips.some((c) => idSet.has(c.id))) {
      throw new EditorError("EDIT_OPERATION_FAILED", `Track ${track.name} is locked`);
    }
    const toRemove = track.clips
      .filter((c) => idSet.has(c.id))
      .sort((a, b) => a.timelineStartMs - b.timelineStartMs);

    if (toRemove.length === 0) continue;

    // Process from left to right, accumulating shift
    let shift = 0;
    const removeSet = new Set(toRemove.map((c) => c.id));
    const remaining = [];
    for (const clip of [...track.clips].sort(
      (a, b) => a.timelineStartMs - b.timelineStartMs,
    )) {
      if (removeSet.has(clip.id)) {
        const dur =
          (clip.timelineEndMs ?? clip.timelineStartMs) - clip.timelineStartMs;
        shift += dur;
        continue;
      }
      if (shift > 0) {
        clip.timelineStartMs = Math.max(0, clip.timelineStartMs - shift);
        if (clip.timelineEndMs !== null) {
          clip.timelineEndMs = Math.max(
            clip.timelineStartMs,
            clip.timelineEndMs - shift,
          );
        }
      }
      remaining.push(clip);
    }
    track.clips = remaining;
  }

  recomputeSequenceDuration(next);
  return next;
}
