import type { Clip, ProjectDocument, Sequence, Transform } from "@pvg/project-format";
import type { EditorCommand } from "../history.js";
import { newId } from "../ids.js";
import {
  findSequence,
  recomputeSequenceDuration,
  replaceSequence,
} from "../timeline/find.js";
import { deleteClips, rippleDeleteClips } from "../timeline/delete.js";
import { moveClips, appendClip, overwriteClip } from "../timeline/move.js";
import { trimClipLeft, trimClipRight } from "../timeline/trim.js";
import { splitClipAt, splitClipsAtPlayhead } from "../timeline/split.js";
import { rollEdit } from "../timeline/roll.js";
import {
  addMarker,
  freezeFrameAt,
  groupClips,
  linkClips,
  setClipReverse,
  setClipSpeed,
  ungroupClips,
  unlinkClip,
} from "../timeline/link.js";
import { findClip } from "../timeline/find.js";
import { snapTargetsMs, snapValue } from "../timeline/move.js";

function mutateSequence(
  project: ProjectDocument,
  sequenceId: string,
  mutator: (seq: Sequence) => Sequence,
): ProjectDocument {
  const seq = findSequence(project.sequences, sequenceId);
  const nextSeq = mutator(seq);
  return {
    ...project,
    sequences: replaceSequence(project.sequences, nextSeq),
    updatedAt: new Date().toISOString(),
  };
}

abstract class SequenceCommand implements EditorCommand {
  readonly id = newId();
  readonly timestamp = Date.now();
  abstract readonly label: string;
  protected before: Sequence | null = null;
  constructor(protected readonly sequenceId: string) {}

  execute(project: ProjectDocument): ProjectDocument {
    const seq = findSequence(project.sequences, this.sequenceId);
    this.before = structuredClone(seq);
    return mutateSequence(project, this.sequenceId, (s) => this.apply(s));
  }

  undo(project: ProjectDocument): ProjectDocument {
    if (!this.before) {
      throw new Error("Cannot undo before execute");
    }
    return {
      ...project,
      sequences: replaceSequence(project.sequences, structuredClone(this.before)),
      updatedAt: new Date().toISOString(),
    };
  }

  protected abstract apply(seq: Sequence): Sequence;
}

export class MoveClipsCommand extends SequenceCommand {
  readonly label = "Moved Clip";
  constructor(
    sequenceId: string,
    private readonly clipIds: string[],
    private readonly deltaMs: number,
    private readonly snap = true,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return moveClips(seq, this.clipIds, this.deltaMs, { snap: this.snap });
  }
}

export class TrimLeftCommand extends SequenceCommand {
  readonly label = "Trimmed Clip";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly newStartMs: number,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return trimClipLeft(seq, this.clipId, this.newStartMs);
  }
}

export class TrimRightCommand extends SequenceCommand {
  readonly label = "Trimmed Clip";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly newEndMs: number,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return trimClipRight(seq, this.clipId, this.newEndMs);
  }
}

export class SplitClipCommand extends SequenceCommand {
  readonly label = "Split Clip";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly atMs: number,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return splitClipAt(seq, this.clipId, this.atMs).sequence;
  }
}

export class SplitAtPlayheadCommand extends SequenceCommand {
  readonly label = "Split Clip";
  constructor(
    sequenceId: string,
    private readonly clipIds: string[],
    private readonly playheadMs: number,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return splitClipsAtPlayhead(seq, this.clipIds, this.playheadMs);
  }
}

export class DeleteClipsCommand extends SequenceCommand {
  readonly label = "Deleted Clip";
  constructor(
    sequenceId: string,
    private readonly clipIds: string[],
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return deleteClips(seq, this.clipIds);
  }
}

export class RippleDeleteCommand extends SequenceCommand {
  readonly label = "Ripple Delete";
  constructor(
    sequenceId: string,
    private readonly clipIds: string[],
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return rippleDeleteClips(seq, this.clipIds);
  }
}

export class RollEditCommand extends SequenceCommand {
  readonly label = "Roll Edit";
  constructor(
    sequenceId: string,
    private readonly leftClipId: string,
    private readonly rightClipId: string,
    private readonly boundaryMs: number,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return rollEdit(seq, this.leftClipId, this.rightClipId, this.boundaryMs);
  }
}

export class AppendClipCommand extends SequenceCommand {
  readonly label = "Added Clip";
  constructor(
    sequenceId: string,
    private readonly trackId: string,
    private readonly clip: Clip,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return appendClip(seq, this.trackId, this.clip);
  }
}

export class OverwriteClipCommand extends SequenceCommand {
  readonly label = "Overwrite Clip";
  constructor(
    sequenceId: string,
    private readonly trackId: string,
    private readonly clip: Clip,
    private readonly atMs: number,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return overwriteClip(seq, this.trackId, this.clip, this.atMs);
  }
}

export class SetSpeedCommand extends SequenceCommand {
  readonly label = "Changed Speed";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly speed: number,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return setClipSpeed(seq, this.clipId, this.speed);
  }
}

export class SetReverseCommand extends SequenceCommand {
  readonly label = "Reverse Clip";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly reverse: boolean,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return setClipReverse(seq, this.clipId, this.reverse);
  }
}

export class FreezeFrameCommand extends SequenceCommand {
  readonly label = "Freeze Frame";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly atMs: number,
    private readonly holdMs = 1000,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return freezeFrameAt(seq, this.clipId, this.atMs, this.holdMs);
  }
}

export class LinkClipsCommand extends SequenceCommand {
  readonly label = "Link Clips";
  constructor(
    sequenceId: string,
    private readonly a: string,
    private readonly b: string,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return linkClips(seq, this.a, this.b);
  }
}

export class UnlinkClipCommand extends SequenceCommand {
  readonly label = "Unlink Clips";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return unlinkClip(seq, this.clipId);
  }
}

export class GroupClipsCommand extends SequenceCommand {
  readonly label = "Group Clips";
  constructor(
    sequenceId: string,
    private readonly clipIds: string[],
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return groupClips(seq, this.clipIds);
  }
}

export class UngroupClipsCommand extends SequenceCommand {
  readonly label = "Ungroup Clips";
  constructor(
    sequenceId: string,
    private readonly clipIds: string[],
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return ungroupClips(seq, this.clipIds);
  }
}

export class AddMarkerCommand extends SequenceCommand {
  readonly label = "Added Marker";
  constructor(
    sequenceId: string,
    private readonly marker: {
      timeMs: number;
      name: string;
      category?: string;
      color?: string | null;
      note?: string | null;
    },
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    return addMarker(seq, this.marker);
  }
}

export class RemoveMarkerCommand extends SequenceCommand {
  readonly label = "Removed Marker";
  constructor(
    sequenceId: string,
    private readonly markerId: string,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    next.markers = next.markers.filter((m) => m.id !== this.markerId);
    return next;
  }
}

export class SetTransformCommand extends SequenceCommand {
  readonly label = "Changed Transform";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly patch: Partial<Transform>,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    const loc = findClip(next, this.clipId);
    loc.clip.transform = { ...loc.clip.transform, ...this.patch };
    // Validate opacity
    if (
      loc.clip.transform.opacity < 0 ||
      loc.clip.transform.opacity > 1 ||
      !Number.isFinite(loc.clip.transform.opacity)
    ) {
      throw new Error("Invalid opacity");
    }
    if (
      !Number.isFinite(loc.clip.transform.scaleX) ||
      loc.clip.transform.scaleX <= 0 ||
      !Number.isFinite(loc.clip.transform.scaleY) ||
      loc.clip.transform.scaleY <= 0
    ) {
      throw new Error("Invalid scale");
    }
    return next;
  }
}

export class SetClipPropertyCommand extends SequenceCommand {
  readonly label: string;
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly patch: Partial<Clip>,
    label = "Set Property",
  ) {
    super(sequenceId);
    this.label = label;
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    const loc = findClip(next, this.clipId);
    Object.assign(loc.clip, this.patch, { id: loc.clip.id });
    recomputeSequenceDuration(next);
    return next;
  }
}

export class AddTrackCommand extends SequenceCommand {
  readonly label = "Add Track";
  constructor(
    sequenceId: string,
    private readonly track: Sequence["tracks"][number],
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    next.tracks.push(this.track);
    return next;
  }
}

export class AddKeyframeCommand extends SequenceCommand {
  readonly label = "Added Keyframe";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly propertyPath: string,
    private readonly keyframe: {
      id?: string;
      timeMs: number;
      value: number | string | boolean;
      interpolation?: "hold" | "linear" | "easeIn" | "easeOut" | "bezier";
      inHandle?: [number, number] | null;
      outHandle?: [number, number] | null;
    },
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    const loc = findClip(next, this.clipId);
    const list = loc.clip.keyframes[this.propertyPath] ?? [];
    const kf = {
      id: this.keyframe.id ?? newId(),
      timeMs: this.keyframe.timeMs,
      value: this.keyframe.value,
      interpolation: this.keyframe.interpolation ?? ("linear" as const),
      inHandle: this.keyframe.inHandle ?? null,
      outHandle: this.keyframe.outHandle ?? null,
    };
    const filtered = list.filter((k) => k.timeMs !== kf.timeMs);
    filtered.push(kf);
    filtered.sort((a, b) => a.timeMs - b.timeMs);
    loc.clip.keyframes[this.propertyPath] = filtered;
    return next;
  }
}

export class DeleteKeyframeCommand extends SequenceCommand {
  readonly label = "Deleted Keyframe";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly propertyPath: string,
    private readonly keyframeId: string,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    const loc = findClip(next, this.clipId);
    const list = loc.clip.keyframes[this.propertyPath] ?? [];
    loc.clip.keyframes[this.propertyPath] = list.filter(
      (k) => k.id !== this.keyframeId,
    );
    return next;
  }
}

export class AddEffectCommand extends SequenceCommand {
  readonly label = "Added Effect";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly effect: Clip["effects"][number],
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    findClip(next, this.clipId).clip.effects.push(this.effect);
    return next;
  }
}

export class SetTransitionCommand extends SequenceCommand {
  readonly label = "Added Transition";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly side: "in" | "out",
    private readonly transition: Clip["transitionIn"],
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    const clip = findClip(next, this.clipId).clip;
    if (this.side === "in") clip.transitionIn = this.transition;
    else clip.transitionOut = this.transition;
    return next;
  }
}

export class DuplicateClipsCommand extends SequenceCommand {
  readonly label = "Duplicated Clip";
  private createdIds: string[] = [];
  constructor(
    sequenceId: string,
    private readonly clipIds: string[],
    private readonly offsetMs = 0,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    this.createdIds = [];
    for (const id of this.clipIds) {
      const loc = findClip(next, id);
      const copy: Clip = {
        ...structuredClone(loc.clip),
        id: newId(),
        timelineStartMs: loc.clip.timelineStartMs + this.offsetMs,
        timelineEndMs:
          loc.clip.timelineEndMs === null
            ? null
            : loc.clip.timelineEndMs + this.offsetMs,
        linkedClipId: null,
      };
      this.createdIds.push(copy.id);
      loc.track.clips.push(copy);
    }
    recomputeSequenceDuration(next);
    return next;
  }
  getCreatedIds(): string[] {
    return this.createdIds;
  }
}

export class ReplaceMediaCommand extends SequenceCommand {
  readonly label = "Replace Media";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly newAssetId: string,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    findClip(next, this.clipId).clip.assetId = this.newAssetId;
    return next;
  }
}

export class SetTrackPropertyCommand extends SequenceCommand {
  readonly label: string;
  constructor(
    sequenceId: string,
    private readonly trackId: string,
    private readonly patch: Partial<
      Pick<
        Sequence["tracks"][number],
        | "muted"
        | "solo"
        | "locked"
        | "visible"
        | "enabled"
        | "name"
        | "height"
      >
    >,
    label = "Track Property",
  ) {
    super(sequenceId);
    this.label = label;
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    const track = next.tracks.find((t) => t.id === this.trackId);
    if (!track) throw new Error("Track not found");
    Object.assign(track, this.patch);
    return next;
  }
}

export class RemoveTrackCommand extends SequenceCommand {
  readonly label = "Remove Track";
  constructor(
    sequenceId: string,
    private readonly trackId: string,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    const idx = next.tracks.findIndex((t) => t.id === this.trackId);
    if (idx < 0) throw new Error("Track not found");
    if (next.tracks[idx]!.clips.length > 0) {
      throw new Error("Cannot remove track with clips");
    }
    if (next.tracks.length <= 1) {
      throw new Error("Cannot remove last track");
    }
    next.tracks.splice(idx, 1);
    return next;
  }
}

/** Move clip(s) to another track at a timeline start (optionally snap). */
export class MoveClipsToTrackCommand extends SequenceCommand {
  readonly label = "Moved to Track";
  constructor(
    sequenceId: string,
    private readonly clipIds: string[],
    private readonly targetTrackId: string,
    private readonly startMs: number,
    private readonly snap = true,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    const target = next.tracks.find((t) => t.id === this.targetTrackId);
    if (!target) throw new Error("Target track not found");
    if (target.locked) throw new Error("Target track is locked");

    const moving: Clip[] = [];
    for (const id of this.clipIds) {
      for (const track of next.tracks) {
        const idx = track.clips.findIndex((c) => c.id === id);
        if (idx >= 0) {
          if (track.locked) throw new Error(`Track ${track.name} is locked`);
          moving.push(track.clips.splice(idx, 1)[0]!);
          break;
        }
      }
    }
    if (moving.length === 0) throw new Error("No clips to move");

    let start = Math.max(0, this.startMs);
    if (this.snap) {
      const targets = snapTargetsMs(next, new Set(this.clipIds));
      start = snapValue(start, targets, 120).value;
    }
    const primary = moving[0]!;
    const delta = start - primary.timelineStartMs;
    for (const clip of moving) {
      clip.timelineStartMs += delta;
      if (clip.timelineEndMs !== null) clip.timelineEndMs += delta;
      target.clips.push(clip);
    }
    recomputeSequenceDuration(next);
    return next;
  }
}

export class RemoveEffectCommand extends SequenceCommand {
  readonly label = "Removed Effect";
  constructor(
    sequenceId: string,
    private readonly clipId: string,
    private readonly effectId: string,
  ) {
    super(sequenceId);
  }
  protected apply(seq: Sequence): Sequence {
    const next = structuredClone(seq);
    const clip = findClip(next, this.clipId).clip;
    clip.effects = clip.effects.filter((e) => e.id !== this.effectId);
    return next;
  }
}
