import type { Sequence } from "@pvg/project-format";
import { EditorError, assertFinite } from "../errors.js";
import { findClip, recomputeSequenceDuration } from "./find.js";

/**
 * Roll edit: adjust shared boundary between two adjacent clips on the same track.
 * Overall sequence span of A+B is preserved.
 */
export function rollEdit(
  sequence: Sequence,
  leftClipId: string,
  rightClipId: string,
  newBoundaryMs: number,
): Sequence {
  assertFinite(newBoundaryMs, "newBoundaryMs");
  const next = structuredClone(sequence);
  const left = findClip(next, leftClipId);
  const right = findClip(next, rightClipId);
  if (left.track.id !== right.track.id) {
    throw new EditorError(
      "EDIT_OPERATION_FAILED",
      "Roll requires adjacent clips on the same track",
    );
  }
  if (left.track.locked) {
    throw new EditorError("EDIT_OPERATION_FAILED", "Track is locked");
  }
  const leftEnd = left.clip.timelineEndMs ?? left.clip.timelineStartMs;
  const rightStart = right.clip.timelineStartMs;
  if (Math.abs(leftEnd - rightStart) > 0.5) {
    throw new EditorError(
      "EDIT_OPERATION_FAILED",
      "Clips are not adjacent for roll",
      { leftEnd, rightStart },
    );
  }
  if (
    newBoundaryMs <= left.clip.timelineStartMs ||
    newBoundaryMs >= (right.clip.timelineEndMs ?? rightStart)
  ) {
    throw new EditorError("INVALID_TIME_RANGE", "Roll boundary out of range");
  }

  const delta = newBoundaryMs - leftEnd;
  left.clip.timelineEndMs = newBoundaryMs;
  if (left.clip.sourceOutMs !== null) {
    left.clip.sourceOutMs += delta * (left.clip.speed || 1);
  }
  right.clip.timelineStartMs = newBoundaryMs;
  right.clip.sourceInMs = Math.max(
    0,
    right.clip.sourceInMs + delta * (right.clip.speed || 1),
  );

  recomputeSequenceDuration(next);
  return next;
}
