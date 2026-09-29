import type { Clip, Sequence } from "@pvg/project-format";
import { EditorError, assertFinite } from "../errors.js";
import {
  clipDurationMs,
  findClip,
  recomputeSequenceDuration,
} from "./find.js";

export function snapTargetsMs(
  sequence: Sequence,
  excludeClipIds: Set<string> = new Set(),
): number[] {
  const targets = new Set<number>([0, sequence.durationMs]);
  for (const m of sequence.markers) {
    targets.add(m.timeMs);
  }
  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      if (excludeClipIds.has(clip.id)) continue;
      targets.add(clip.timelineStartMs);
      if (clip.timelineEndMs !== null) targets.add(clip.timelineEndMs);
    }
  }
  return [...targets].sort((a, b) => a - b);
}

export function snapValue(
  valueMs: number,
  targets: number[],
  thresholdMs: number,
): { value: number; snapped: boolean; target: number | null } {
  let best = valueMs;
  let bestDist = thresholdMs;
  let target: number | null = null;
  for (const t of targets) {
    const d = Math.abs(t - valueMs);
    if (d <= bestDist) {
      bestDist = d;
      best = t;
      target = t;
    }
  }
  return { value: best, snapped: target !== null, target };
}

/** Move one or more clips by deltaMs on their tracks. Linked clips move together. */
export function moveClips(
  sequence: Sequence,
  clipIds: string[],
  deltaMs: number,
  options: { snap?: boolean; snapThresholdMs?: number } = {},
): Sequence {
  assertFinite(deltaMs, "deltaMs");
  const next = structuredClone(sequence);
  const idSet = new Set(clipIds);

  // Expand linked pairs
  for (const id of [...idSet]) {
    const loc = findClip(next, id);
    if (loc.clip.linkedClipId) idSet.add(loc.clip.linkedClipId);
    if (loc.clip.groupId) {
      for (const track of next.tracks) {
        for (const c of track.clips) {
          if (c.groupId === loc.clip.groupId) idSet.add(c.id);
        }
      }
    }
  }

  const moves: { clip: Clip; start: number; end: number | null }[] = [];
  for (const id of idSet) {
    const loc = findClip(next, id);
    if (loc.track.locked) {
      throw new EditorError("EDIT_OPERATION_FAILED", `Track ${loc.track.name} is locked`, {
        trackId: loc.track.id,
      });
    }
    let start = Math.max(0, loc.clip.timelineStartMs + deltaMs);
    let end =
      loc.clip.timelineEndMs === null
        ? null
        : Math.max(start, loc.clip.timelineEndMs + deltaMs);

    if (options.snap) {
      const targets = snapTargetsMs(next, idSet);
      const snapped = snapValue(
        start,
        targets,
        options.snapThresholdMs ?? 80,
      );
      if (snapped.snapped) {
        const shift = snapped.value - start;
        start = snapped.value;
        if (end !== null) end += shift;
      }
    }

    moves.push({ clip: loc.clip, start, end });
  }

  for (const m of moves) {
    m.clip.timelineStartMs = m.start;
    m.clip.timelineEndMs = m.end;
  }

  recomputeSequenceDuration(next);
  return next;
}

export function appendClip(
  sequence: Sequence,
  trackId: string,
  clip: Clip,
): Sequence {
  const next = structuredClone(sequence);
  const track = next.tracks.find((t) => t.id === trackId);
  if (!track) {
    throw new EditorError("TRACK_NOT_FOUND", `Track ${trackId} not found`);
  }
  if (track.locked) {
    throw new EditorError("EDIT_OPERATION_FAILED", "Track is locked");
  }
  let start = 0;
  for (const c of track.clips) {
    const end = c.timelineEndMs ?? c.timelineStartMs;
    if (end > start) start = end;
  }
  const dur = clipDurationMs(clip) || sourceDurationFrom(clip);
  clip.timelineStartMs = start;
  clip.timelineEndMs = start + dur;
  track.clips.push(clip);
  recomputeSequenceDuration(next);
  return next;
}

function sourceDurationFrom(clip: Clip): number {
  const out = clip.sourceOutMs ?? clip.sourceInMs + 1000;
  return Math.max(1, out - clip.sourceInMs);
}

export function overwriteClip(
  sequence: Sequence,
  trackId: string,
  clip: Clip,
  atMs: number,
): Sequence {
  assertFinite(atMs, "atMs");
  if (atMs < 0) {
    throw new EditorError("INVALID_TIME_RANGE", "Cannot place clip at negative time");
  }
  const next = structuredClone(sequence);
  const track = next.tracks.find((t) => t.id === trackId);
  if (!track) {
    throw new EditorError("TRACK_NOT_FOUND", `Track ${trackId} not found`);
  }
  if (track.locked) {
    throw new EditorError("EDIT_OPERATION_FAILED", "Track is locked");
  }
  const dur = clipDurationMs(clip) || sourceDurationFrom(clip);
  clip.timelineStartMs = atMs;
  clip.timelineEndMs = atMs + dur;
  // Remove overlapping clips on same track (overwrite semantics)
  track.clips = track.clips.filter((c) => {
    const cEnd = c.timelineEndMs ?? c.timelineStartMs;
    return cEnd <= atMs || c.timelineStartMs >= atMs + dur;
  });
  track.clips.push(clip);
  track.clips.sort((a, b) => a.timelineStartMs - b.timelineStartMs);
  recomputeSequenceDuration(next);
  return next;
}
