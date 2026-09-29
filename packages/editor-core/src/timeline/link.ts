import type { Sequence } from "@pvg/project-format";
import { EditorError } from "../errors.js";
import { findClip, recomputeSequenceDuration } from "./find.js";
import { newId } from "../ids.js";

export function linkClips(
  sequence: Sequence,
  clipIdA: string,
  clipIdB: string,
): Sequence {
  const next = structuredClone(sequence);
  const a = findClip(next, clipIdA);
  const b = findClip(next, clipIdB);
  a.clip.linkedClipId = b.clip.id;
  b.clip.linkedClipId = a.clip.id;
  return next;
}

export function unlinkClip(sequence: Sequence, clipId: string): Sequence {
  const next = structuredClone(sequence);
  const loc = findClip(next, clipId);
  const otherId = loc.clip.linkedClipId;
  loc.clip.linkedClipId = null;
  if (otherId) {
    try {
      const other = findClip(next, otherId);
      if (other.clip.linkedClipId === clipId) {
        other.clip.linkedClipId = null;
      }
    } catch {
      /* orphan link */
    }
  }
  return next;
}

export function groupClips(sequence: Sequence, clipIds: string[]): Sequence {
  if (clipIds.length < 2) {
    throw new EditorError("INVALID_SELECTION", "Need at least 2 clips to group");
  }
  const next = structuredClone(sequence);
  const groupId = newId();
  for (const id of clipIds) {
    findClip(next, id).clip.groupId = groupId;
  }
  return next;
}

export function ungroupClips(sequence: Sequence, clipIds: string[]): Sequence {
  const next = structuredClone(sequence);
  for (const id of clipIds) {
    findClip(next, id).clip.groupId = null;
  }
  return next;
}

export function setClipSpeed(
  sequence: Sequence,
  clipId: string,
  speed: number,
): Sequence {
  if (!Number.isFinite(speed) || speed <= 0 || speed > 16) {
    throw new EditorError("COMMAND_INVALID", "Speed must be in (0, 16]", { speed });
  }
  const next = structuredClone(sequence);
  const loc = findClip(next, clipId);
  const oldSpeed = loc.clip.speed || 1;
  const dur =
    (loc.clip.timelineEndMs ?? loc.clip.timelineStartMs) -
    loc.clip.timelineStartMs;
  // Keep source range; adjust timeline duration inversely with speed
  const newDur = (dur * oldSpeed) / speed;
  loc.clip.speed = speed;
  loc.clip.timelineEndMs = loc.clip.timelineStartMs + newDur;
  recomputeSequenceDuration(next);
  return next;
}

export function setClipReverse(
  sequence: Sequence,
  clipId: string,
  reverse: boolean,
): Sequence {
  const next = structuredClone(sequence);
  findClip(next, clipId).clip.reverse = reverse;
  return next;
}

export function freezeFrameAt(
  sequence: Sequence,
  clipId: string,
  atMs: number,
  holdMs = 1000,
): Sequence {
  const next = structuredClone(sequence);
  const loc = findClip(next, clipId);
  if (atMs < loc.clip.timelineStartMs || atMs > (loc.clip.timelineEndMs ?? 0)) {
    throw new EditorError("INVALID_TIME_RANGE", "Freeze point outside clip");
  }
  // Represent freeze as a derived zero-speed hold via timeline extension of a split range.
  // Phase 4: create a short clip segment with speed near-zero marker via reverse=false + label.
  const ratio =
    (atMs - loc.clip.timelineStartMs) /
    Math.max(
      1,
      (loc.clip.timelineEndMs ?? loc.clip.timelineStartMs) -
        loc.clip.timelineStartMs,
    );
  const srcSpan =
    (loc.clip.sourceOutMs ?? loc.clip.sourceInMs) - loc.clip.sourceInMs;
  const sourceAt = loc.clip.sourceInMs + srcSpan * ratio;

  const freeze = {
    ...structuredClone(loc.clip),
    id: newId(),
    timelineStartMs: atMs,
    timelineEndMs: atMs + holdMs,
    sourceInMs: sourceAt,
    sourceOutMs: sourceAt + 1 / 30, // one frame of source
    speed: 0.0001,
    label: loc.clip.label ? `${loc.clip.label} (freeze)` : "Freeze frame",
    linkedClipId: null,
  };
  loc.track.clips.push(freeze);
  loc.track.clips.sort((a, b) => a.timelineStartMs - b.timelineStartMs);
  recomputeSequenceDuration(next);
  return next;
}

export function addMarker(
  sequence: Sequence,
  marker: {
    timeMs: number;
    name: string;
    category?: string;
    color?: string | null;
    note?: string | null;
  },
): Sequence {
  const next = structuredClone(sequence);
  next.markers.push({
    id: newId(),
    timeMs: marker.timeMs,
    name: marker.name,
    category: marker.category ?? "marker",
    color: marker.color ?? null,
    note: marker.note ?? null,
  });
  return next;
}
