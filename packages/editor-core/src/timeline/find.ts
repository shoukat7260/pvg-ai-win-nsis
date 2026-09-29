import type { Clip, Sequence, Track } from "@pvg/project-format";
import { EditorError } from "../errors.js";
import type { LocatedClip } from "../types.js";

export function findSequence(
  sequences: Sequence[],
  sequenceId: string,
): Sequence {
  const seq = sequences.find((s) => s.id === sequenceId);
  if (!seq) {
    throw new EditorError("SEQUENCE_NOT_FOUND", `Sequence ${sequenceId} not found`, {
      sequenceId,
    });
  }
  return seq;
}

export function findTrack(sequence: Sequence, trackId: string): {
  track: Track;
  index: number;
} {
  const index = sequence.tracks.findIndex((t) => t.id === trackId);
  if (index < 0) {
    throw new EditorError("TRACK_NOT_FOUND", `Track ${trackId} not found`, {
      trackId,
      sequenceId: sequence.id,
    });
  }
  return { track: sequence.tracks[index]!, index };
}

export function findClip(
  sequence: Sequence,
  clipId: string,
): LocatedClip {
  for (let trackIndex = 0; trackIndex < sequence.tracks.length; trackIndex++) {
    const track = sequence.tracks[trackIndex]!;
    const clipIndex = track.clips.findIndex((c) => c.id === clipId);
    if (clipIndex >= 0) {
      return {
        sequence,
        track,
        clip: track.clips[clipIndex]!,
        trackIndex,
        clipIndex,
      };
    }
  }
  throw new EditorError("CLIP_NOT_FOUND", `Clip ${clipId} not found`, {
    clipId,
    sequenceId: sequence.id,
  });
}

export function findClips(
  sequence: Sequence,
  clipIds: string[],
): LocatedClip[] {
  return clipIds.map((id) => findClip(sequence, id));
}

export function clipDurationMs(clip: Clip): number {
  const end = clip.timelineEndMs ?? clip.timelineStartMs;
  return Math.max(0, end - clip.timelineStartMs);
}

export function sourceDurationMs(clip: Clip): number {
  const out = clip.sourceOutMs ?? clip.sourceInMs;
  return Math.max(0, out - clip.sourceInMs);
}

export function recomputeSequenceDuration(sequence: Sequence): number {
  let max = 0;
  for (const track of sequence.tracks) {
    for (const clip of track.clips) {
      const end = clip.timelineEndMs ?? clip.timelineStartMs;
      if (end > max) max = end;
    }
  }
  sequence.durationMs = max;
  return max;
}

export function cloneSequence(sequence: Sequence): Sequence {
  return structuredClone(sequence);
}

export function replaceSequence(
  sequences: Sequence[],
  next: Sequence,
): Sequence[] {
  return sequences.map((s) => (s.id === next.id ? next : s));
}
