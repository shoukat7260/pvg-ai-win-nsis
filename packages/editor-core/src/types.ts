import type {
  Clip,
  Marker,
  ProjectDocument,
  Sequence,
  Track,
  Transform,
} from "@pvg/project-format";

export type EditMode = "select" | "razor" | "text" | "hand";
export type InsertMode = "insert" | "overwrite" | "append";
export type RippleMode = "off" | "ripple";

export interface EditorSelection {
  clipIds: string[];
  trackIds: string[];
  keyframeIds: string[];
  markerIds: string[];
}

export interface PlaybackState {
  playing: boolean;
  currentTimeMs: number;
  rate: number;
  inPointMs: number | null;
  outPointMs: number | null;
  loop: boolean;
  previewMode: "proxy" | "original" | "auto";
}

export interface TimelineUiState {
  zoom: number;
  scrollMs: number;
  snapEnabled: boolean;
  rippleMode: RippleMode;
  trackHeights: Record<string, number>;
}

export interface EditorDocumentState {
  project: ProjectDocument;
  activeSequenceId: string;
  selection: EditorSelection;
  playback: PlaybackState;
  timelineUi: TimelineUiState;
  dirty: boolean;
  tool: EditMode;
  insertMode: InsertMode;
}

export interface ClipRef {
  sequenceId: string;
  trackId: string;
  clipId: string;
}

export interface LocatedClip {
  sequence: Sequence;
  track: Track;
  clip: Clip;
  trackIndex: number;
  clipIndex: number;
}

export type { Clip, Marker, ProjectDocument, Sequence, Track, Transform };

export const EMPTY_SELECTION: EditorSelection = {
  clipIds: [],
  trackIds: [],
  keyframeIds: [],
  markerIds: [],
};

export function defaultTransform(): Transform {
  return {
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    anchorX: 0.5,
    anchorY: 0.5,
    opacity: 1,
    flipX: false,
    flipY: false,
  };
}

export function defaultPlayback(): PlaybackState {
  return {
    playing: false,
    currentTimeMs: 0,
    rate: 1,
    inPointMs: null,
    outPointMs: null,
    loop: false,
    previewMode: "auto",
  };
}

export function defaultTimelineUi(): TimelineUiState {
  return {
    zoom: 1,
    scrollMs: 0,
    snapEnabled: true,
    rippleMode: "off",
    trackHeights: {},
  };
}
