/** Editor-core error codes — never corrupt project state on failure. */
export type EditorErrorCode =
  | "CLIP_NOT_FOUND"
  | "TRACK_NOT_FOUND"
  | "SEQUENCE_NOT_FOUND"
  | "INVALID_TIME_RANGE"
  | "INVALID_SELECTION"
  | "MEDIA_UNAVAILABLE"
  | "EDIT_OPERATION_FAILED"
  | "TRANSFORM_INVALID"
  | "KEYFRAME_INVALID"
  | "TRANSITION_INVALID"
  | "UNDO_FAILED"
  | "REDO_FAILED"
  | "SAVE_FAILED"
  | "PREVIEW_FAILED"
  | "COMMAND_INVALID"
  | "AI_TOOL_DENIED"
  | "AI_SCHEMA_INVALID"
  | "AI_CONFIRMATION_REQUIRED";

export class EditorError extends Error {
  readonly code: EditorErrorCode;
  readonly details?: Record<string, unknown>;

  constructor(
    code: EditorErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "EditorError";
    this.code = code;
    this.details = details;
  }
}

export function assertFinite(n: number, label: string): number {
  if (!Number.isFinite(n) || Number.isNaN(n)) {
    throw new EditorError("COMMAND_INVALID", `${label} must be a finite number`, {
      value: n,
    });
  }
  return n;
}
