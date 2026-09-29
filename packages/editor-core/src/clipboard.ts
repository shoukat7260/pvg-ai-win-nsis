import type { Clip } from "@pvg/project-format";
import { newId } from "./ids.js";

export const CLIPBOARD_FORMAT = "PVG_CLIPBOARD_V1" as const;

export interface EditorClipboardPayload {
  format: typeof CLIPBOARD_FORMAT;
  clips: Clip[];
  relativeOriginMs: number;
}

export function serializeClipboard(clips: Clip[]): EditorClipboardPayload {
  const origin = Math.min(...clips.map((c) => c.timelineStartMs), 0);
  return {
    format: CLIPBOARD_FORMAT,
    relativeOriginMs: origin,
    clips: clips.map((c) => structuredClone(c)),
  };
}

export function pasteClipboard(
  payload: EditorClipboardPayload,
  atMs: number,
): Clip[] {
  if (payload.format !== CLIPBOARD_FORMAT) {
    throw new Error("Unsupported clipboard format");
  }
  return payload.clips.map((c) => {
    const start =
      atMs + (c.timelineStartMs - payload.relativeOriginMs);
    const dur =
      (c.timelineEndMs ?? c.timelineStartMs) - c.timelineStartMs;
    return {
      ...structuredClone(c),
      id: newId(),
      timelineStartMs: Math.max(0, start),
      timelineEndMs: Math.max(0, start) + dur,
      linkedClipId: null,
    };
  });
}
