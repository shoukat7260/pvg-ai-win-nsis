import type { Clip, ProjectDocument, Sequence, Track } from "@pvg/project-format";
import { newId } from "./ids.js";
import { defaultTransform } from "./types.js";

export function createDefaultTracks(): Track[] {
  return [
    makeTrack("video", "V1"),
    makeTrack("video", "V2"),
    makeTrack("overlay", "Overlay"),
    makeTrack("text", "Text"),
    makeTrack("audio", "A1"),
    makeTrack("audio", "A2"),
  ];
}

export function makeTrack(
  type: Track["type"],
  name: string,
): Track {
  return {
    id: newId(),
    type,
    name,
    enabled: true,
    locked: false,
    muted: false,
    solo: false,
    visible: true,
    height: type === "audio" ? 40 : 48,
    colorLabel: null,
    clips: [],
  };
}

export function ensureEditorTracks(sequence: Sequence): Sequence {
  if (sequence.tracks.length > 0) return sequence;
  return { ...sequence, tracks: createDefaultTracks() };
}

export function createMediaClip(params: {
  assetId: string;
  kind: Clip["kind"];
  durationMs: number;
  startMs?: number;
  label?: string;
}): Clip {
  const start = params.startMs ?? 0;
  return {
    id: newId(),
    assetId: params.assetId,
    kind: params.kind,
    sourceInMs: 0,
    sourceOutMs: params.durationMs,
    timelineStartMs: start,
    timelineEndMs: start + params.durationMs,
    enabled: true,
    speed: 1,
    reverse: false,
    volume: 1,
    transform: defaultTransform(),
    linkedClipId: null,
    groupId: null,
    effects: [],
    transitionIn: null,
    transitionOut: null,
    text: null,
    shape: null,
    mask: {
      type: "none",
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      feather: 0,
      opacity: 1,
      invert: false,
    },
    blendMode: "normal",
    keyframes: {},
    label: params.label ?? null,
  };
}

export function createTextClip(params: {
  content: string;
  startMs: number;
  durationMs?: number;
}): Clip {
  const dur = params.durationMs ?? 3000;
  return {
    ...createMediaClip({
      assetId: "00000000-0000-4000-8000-000000000000",
      kind: "text",
      durationMs: dur,
      startMs: params.startMs,
      label: params.content.slice(0, 40),
    }),
    assetId: null,
    text: {
      content: params.content,
      fontFamily: "IBM Plex Sans",
      fontSize: 48,
      fontWeight: 600,
      fontStyle: "normal",
      align: "center",
      lineHeight: 1.2,
      letterSpacing: 0,
      color: "#FFFFFF",
      strokeColor: null,
      strokeWidth: 0,
      shadowColor: "rgba(0,0,0,0.5)",
      shadowBlur: 8,
      backgroundColor: null,
      padding: 8,
    },
  };
}

export function createShapeClip(params: {
  kind: "rectangle" | "circle" | "line" | "arrow";
  startMs: number;
  durationMs?: number;
}): Clip {
  const dur = params.durationMs ?? 5000;
  return {
    ...createMediaClip({
      assetId: "00000000-0000-4000-8000-000000000000",
      kind: "shape",
      durationMs: dur,
      startMs: params.startMs,
      label: params.kind,
    }),
    assetId: null,
    shape: {
      kind: params.kind,
      fill: "#3db8a8",
      stroke: "#ffffff",
      strokeWidth: 2,
      width: 240,
      height: 140,
      cornerRadius: 8,
    },
  };
}

export function activeSequence(
  project: ProjectDocument,
  sequenceId?: string | null,
): Sequence {
  if (sequenceId) {
    const found = project.sequences.find((s) => s.id === sequenceId);
    if (found) return found;
  }
  if (!project.sequences[0]) {
    throw new Error("Project has no sequences");
  }
  return project.sequences[0];
}
