import type { Clip } from "@pvg/project-format";
import {
  AddEffectCommand,
  SetTransitionCommand,
  newId,
  type EditorCommand,
} from "@pvg/editor-core";

export type LibraryItemStatus = "ready" | "unavailable";

export interface EffectLibraryItem {
  id: string;
  label: string;
  status: LibraryItemStatus;
  /** Schema effect type when status=ready */
  effectType?: Clip["effects"][number]["type"];
  defaultParams?: Record<string, number | string | boolean>;
}

type TransitionType = NonNullable<Clip["transitionIn"]>["type"];

export interface TransitionLibraryItem {
  id: string;
  label: string;
  status: LibraryItemStatus;
  transitionType?: TransitionType;
  /** When true, clears both in/out transitions (Cut). */
  clear?: boolean;
}

export interface ColorLibraryItem {
  id: string;
  label: string;
  status: LibraryItemStatus;
  effectType?: Clip["effects"][number]["type"];
  defaultParams?: Record<string, number | string | boolean>;
}

/** Effects browser — every row is either a real AddEffectCommand or labeled unavailable. */
export const EFFECT_LIBRARY: EffectLibraryItem[] = [
  { id: "blur", label: "Blur", status: "ready", effectType: "blur", defaultParams: { amount: 4 } },
  {
    id: "brightness_contrast",
    label: "Brightness / Contrast",
    status: "ready",
    effectType: "brightness_contrast",
    defaultParams: { brightness: 0.1, contrast: 0.05 },
  },
  {
    id: "saturation",
    label: "Saturation",
    status: "ready",
    effectType: "saturation",
    defaultParams: { amount: 1.2 },
  },
  {
    id: "sharpen",
    label: "Sharpen",
    status: "ready",
    effectType: "sharpen",
    defaultParams: { amount: 0.4 },
  },
  {
    id: "opacity",
    label: "Opacity",
    status: "ready",
    effectType: "opacity",
    defaultParams: { amount: 0.85 },
  },
  {
    id: "exposure",
    label: "Exposure",
    status: "ready",
    effectType: "exposure",
    defaultParams: { amount: 0.15 },
  },
  {
    id: "vignette",
    label: "Vignette",
    status: "ready",
    effectType: "vignette",
    defaultParams: { amount: 0.35 },
  },
  {
    id: "grayscale",
    label: "Grayscale",
    status: "ready",
    effectType: "grayscale",
    defaultParams: {},
  },
  { id: "glow", label: "Glow", status: "unavailable" },
  { id: "mirror", label: "Mirror", status: "unavailable" },
  { id: "chroma", label: "Chromatic Aberration", status: "unavailable" },
];

/** Transitions browser — SetTransitionCommand when supported. */
export const TRANSITION_LIBRARY: TransitionLibraryItem[] = [
  { id: "cut", label: "Cut", status: "ready", clear: true },
  { id: "dissolve", label: "Dissolve", status: "ready", transitionType: "dissolve" },
  { id: "fade", label: "Fade", status: "ready", transitionType: "fade" },
  {
    id: "dip_to_color",
    label: "Dip to Color",
    status: "ready",
    transitionType: "dip_to_color",
  },
  { id: "wipe", label: "Wipe", status: "unavailable" },
  { id: "slide", label: "Slide", status: "unavailable" },
  { id: "zoom", label: "Zoom", status: "unavailable" },
  { id: "push", label: "Push", status: "unavailable" },
];

/** Color panel foundation — color-related effects via AddEffectCommand. */
export const COLOR_LIBRARY: ColorLibraryItem[] = [
  {
    id: "brightness_contrast",
    label: "Brightness / Contrast",
    status: "ready",
    effectType: "brightness_contrast",
    defaultParams: { brightness: 0, contrast: 0 },
  },
  {
    id: "exposure",
    label: "Exposure",
    status: "ready",
    effectType: "exposure",
    defaultParams: { amount: 0 },
  },
  {
    id: "saturation",
    label: "Saturation",
    status: "ready",
    effectType: "saturation",
    defaultParams: { amount: 1 },
  },
  {
    id: "temperature",
    label: "Temperature",
    status: "ready",
    effectType: "temperature",
    defaultParams: { amount: 0 },
  },
  {
    id: "tint",
    label: "Tint",
    status: "ready",
    effectType: "tint",
    defaultParams: { amount: 0 },
  },
  {
    id: "vignette",
    label: "Vignette",
    status: "ready",
    effectType: "vignette",
    defaultParams: { amount: 0.25 },
  },
  {
    id: "grayscale",
    label: "Grayscale",
    status: "ready",
    effectType: "grayscale",
    defaultParams: {},
  },
  { id: "curves", label: "Curves", status: "unavailable" },
  { id: "lut", label: "LUT", status: "unavailable" },
  { id: "wheels", label: "Color Wheels", status: "unavailable" },
];

export function buildAddEffectCommands(
  sequenceId: string,
  clipIds: string[],
  item: EffectLibraryItem | ColorLibraryItem,
): EditorCommand[] {
  if (item.status !== "ready" || !item.effectType) return [];
  return clipIds.map(
    (clipId) =>
      new AddEffectCommand(sequenceId, clipId, {
        id: newId(),
        type: item.effectType!,
        enabled: true,
        params: { ...(item.defaultParams ?? {}) },
      }),
  );
}

export function buildSetTransitionCommands(
  sequenceId: string,
  clipIds: string[],
  item: TransitionLibraryItem,
  side: "in" | "out" = "out",
): EditorCommand[] {
  if (item.status !== "ready") return [];
  if (item.clear) {
    return clipIds.flatMap((clipId) => [
      new SetTransitionCommand(sequenceId, clipId, "in", null),
      new SetTransitionCommand(sequenceId, clipId, "out", null),
    ]);
  }
  if (!item.transitionType) return [];
  return clipIds.map(
    (clipId) =>
      new SetTransitionCommand(sequenceId, clipId, side, {
        id: newId(),
        type: item.transitionType!,
        durationMs: 500,
        params: {},
      }),
  );
}
