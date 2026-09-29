export { EditorError, assertFinite, type EditorErrorCode } from "./errors.js";
export { newId } from "./ids.js";
export {
  type EditMode,
  type InsertMode,
  type RippleMode,
  type EditorSelection,
  type PlaybackState,
  type TimelineUiState,
  type EditorDocumentState,
  type ClipRef,
  type LocatedClip,
  EMPTY_SELECTION,
  defaultTransform,
  defaultPlayback,
  defaultTimelineUi,
} from "./types.js";
export { HistoryStack, type EditorCommand } from "./history.js";
export {
  findSequence,
  findTrack,
  findClip,
  findClips,
  clipDurationMs,
  sourceDurationMs,
  recomputeSequenceDuration,
  cloneSequence,
  replaceSequence,
} from "./timeline/find.js";
export {
  snapTargetsMs,
  snapValue,
  moveClips,
  appendClip,
  overwriteClip,
} from "./timeline/move.js";
export { trimClipLeft, trimClipRight } from "./timeline/trim.js";
export { splitClipAt, splitClipsAtPlayhead } from "./timeline/split.js";
export { deleteClips, rippleDeleteClips } from "./timeline/delete.js";
export { rollEdit } from "./timeline/roll.js";
export {
  linkClips,
  unlinkClip,
  groupClips,
  ungroupClips,
  setClipSpeed,
  setClipReverse,
  freezeFrameAt,
  addMarker,
} from "./timeline/link.js";
export * from "./commands/clipCommands.js";
export {
  interpolateNumber,
  evaluateKeyframes,
  evaluateTransformProperty,
  motionPreset,
  type MotionPresetId,
  type MotionPresetResult,
} from "./keyframes/evaluate.js";
export { composeAtTime, type ResolvedLayer } from "./composition.js";
export {
  CLIPBOARD_FORMAT,
  serializeClipboard,
  pasteClipboard,
  type EditorClipboardPayload,
} from "./clipboard.js";
export {
  createDefaultTracks,
  makeTrack,
  ensureEditorTracks,
  createMediaClip,
  createTextClip,
  createShapeClip,
  activeSequence,
} from "./defaults.js";
export {
  AI_TOOL_NAMES,
  AiToolCallSchema,
  AiPlanSchema,
  DESTRUCTIVE_TOOLS,
  FORBIDDEN_AI_TOOLS,
  type AiToolName,
  type AiToolCall,
  type AiPlan,
} from "./ai/schemas.js";
export {
  buildAiContext,
  parseAiToolCall,
  parseAiPlan,
  isDestructivePlan,
  toolCallToCommands,
  planToCommands,
  tryLocalEditPlan,
  type AiEditorContext,
} from "./ai/tools.js";
