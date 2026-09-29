import { z } from "zod";
import { CURRENT_PROJECT_SCHEMA_VERSION } from "./version.js";

const UuidSchema = z.string().uuid();
const IsoDateTimeSchema = z.string().datetime({ offset: true });

/** Relative path inside the bundle — no absolute paths, no `..` segments. */
export const RelativePathSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine(
    (p) =>
      !p.startsWith("/") &&
      !p.includes("\\") &&
      !p.split("/").includes("..") &&
      !p.includes("\0"),
    { message: "Invalid relative path" },
  );

export const MediaAvailabilitySchema = z.enum([
  "available",
  "missing",
  "inaccessible",
  "changed",
  "unsupported",
  "corrupt",
  "partially_supported",
]);

export const MediaLocationSchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("link"),
    absolutePath: z.string().min(1).max(4096),
  }),
  z.object({
    mode: z.literal("copy"),
    relativePath: RelativePathSchema,
  }),
]);

export const VideoMetadataSchema = z.object({
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  durationMs: z.number().nonnegative().nullable().default(null),
  frameRate: z.number().positive().nullable().default(null),
  codec: z.string().max(64).nullable().default(null),
  container: z.string().max(64).nullable().default(null),
  pixelFormat: z.string().max(64).nullable().default(null),
  bitrate: z.number().int().nonnegative().nullable().default(null),
  rotation: z.number().nullable().default(null),
  hasAudio: z.boolean().default(false),
});

export const AudioMetadataSchema = z.object({
  durationMs: z.number().nonnegative().nullable().default(null),
  sampleRate: z.number().int().positive().nullable().default(null),
  channels: z.number().int().positive().nullable().default(null),
  codec: z.string().max(64).nullable().default(null),
  bitrate: z.number().int().nonnegative().nullable().default(null),
  bitDepth: z.number().int().positive().nullable().default(null),
});

export const ImageMetadataSchema = z.object({
  width: z.number().int().positive().nullable().default(null),
  height: z.number().int().positive().nullable().default(null),
  format: z.string().max(32).nullable().default(null),
  orientation: z.number().int().nullable().default(null),
  hasAlpha: z.boolean().default(false),
});

export const DerivativeRefSchema = z.object({
  relativePath: RelativePathSchema,
  engineVersion: z.string().min(1).max(64),
  createdAt: IsoDateTimeSchema,
  byteSize: z.number().int().nonnegative().nullable().default(null),
});

export const ProjectAssetSchema = z.object({
  id: UuidSchema,
  kind: z.enum(["image", "video", "audio", "caption", "thumbnail", "other"]),
  name: z.string().min(1).max(500),
  /** Managed-bundle relative path when mode=copy; optional display stub when link. */
  relativePath: RelativePathSchema,
  location: MediaLocationSchema.optional(),
  mimeType: z.string().max(200).nullable().default(null),
  byteSize: z.number().int().nonnegative().nullable().default(null),
  /** Optional reference to another asset id (e.g. proxy → source). */
  sourceAssetId: UuidSchema.nullable().default(null),
  availability: MediaAvailabilitySchema.default("available"),
  fingerprint: z.string().max(128).nullable().default(null),
  video: VideoMetadataSchema.nullable().default(null),
  audio: AudioMetadataSchema.nullable().default(null),
  image: ImageMetadataSchema.nullable().default(null),
  thumbnail: DerivativeRefSchema.nullable().default(null),
  waveform: DerivativeRefSchema.nullable().default(null),
  proxy: DerivativeRefSchema.nullable().default(null),
  binId: UuidSchema.nullable().default(null),
  favorite: z.boolean().default(false),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const MediaBinSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(200),
  parentId: UuidSchema.nullable().default(null),
});

/**
 * Timeline / sequence — Phase 3 foundation, Phase 4 editor fields.
 * Source assets remain untouched; clips are non-destructive references.
 */
export const TransformSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  scaleX: z.number().positive().default(1),
  scaleY: z.number().positive().default(1),
  rotation: z.number().default(0),
  anchorX: z.number().default(0.5),
  anchorY: z.number().default(0.5),
  opacity: z.number().min(0).max(1).default(1),
  flipX: z.boolean().default(false),
  flipY: z.boolean().default(false),
});

export const KeyframeInterpolationSchema = z.enum([
  "hold",
  "linear",
  "easeIn",
  "easeOut",
  "bezier",
]);

export const KeyframeSchema = z.object({
  id: UuidSchema,
  timeMs: z.number().nonnegative(),
  value: z.union([z.number(), z.string(), z.boolean()]),
  interpolation: KeyframeInterpolationSchema.default("linear"),
  /** Optional Bezier handles (normalized 0–1). */
  inHandle: z.tuple([z.number(), z.number()]).nullable().default(null),
  outHandle: z.tuple([z.number(), z.number()]).nullable().default(null),
});

export const EffectInstanceSchema = z.object({
  id: UuidSchema,
  type: z.enum([
    "blur",
    "brightness_contrast",
    "saturation",
    "sharpen",
    "opacity",
    "exposure",
    "temperature",
    "tint",
    "vignette",
    "grayscale",
  ]),
  enabled: z.boolean().default(true),
  params: z.record(z.union([z.number(), z.string(), z.boolean()])).default({}),
});

export const TransitionInstanceSchema = z.object({
  id: UuidSchema,
  type: z.enum(["cut", "dissolve", "fade", "dip_to_color", "wipe", "slide"]),
  durationMs: z.number().positive().default(500),
  params: z.record(z.union([z.number(), z.string(), z.boolean()])).default({}),
});

export const TextStyleSchema = z.object({
  content: z.string().max(10000).default(""),
  fontFamily: z.string().max(120).default("Inter"),
  fontSize: z.number().positive().default(48),
  fontWeight: z.number().int().min(100).max(900).default(600),
  fontStyle: z.enum(["normal", "italic"]).default("normal"),
  align: z.enum(["left", "center", "right"]).default("center"),
  lineHeight: z.number().positive().default(1.2),
  letterSpacing: z.number().default(0),
  color: z.string().max(32).default("#FFFFFF"),
  strokeColor: z.string().max(32).nullable().default(null),
  strokeWidth: z.number().nonnegative().default(0),
  shadowColor: z.string().max(32).nullable().default(null),
  shadowBlur: z.number().nonnegative().default(0),
  backgroundColor: z.string().max(32).nullable().default(null),
  padding: z.number().nonnegative().default(0),
});

export const ShapeStyleSchema = z.object({
  kind: z.enum(["rectangle", "circle", "line", "arrow"]),
  fill: z.string().max(32).default("#FFFFFF"),
  stroke: z.string().max(32).nullable().default(null),
  strokeWidth: z.number().nonnegative().default(0),
  width: z.number().positive().default(200),
  height: z.number().positive().default(200),
  cornerRadius: z.number().nonnegative().default(0),
});

export const MaskFoundationSchema = z.object({
  type: z.enum(["none", "rectangle", "ellipse"]).default("none"),
  x: z.number().default(0),
  y: z.number().default(0),
  width: z.number().positive().default(1),
  height: z.number().positive().default(1),
  feather: z.number().nonnegative().default(0),
  opacity: z.number().min(0).max(1).default(1),
  invert: z.boolean().default(false),
});

export const ClipSchema = z.object({
  id: UuidSchema,
  assetId: UuidSchema.nullable().default(null),
  kind: z
    .enum(["video", "audio", "image", "text", "shape", "adjustment"])
    .default("video"),
  sourceInMs: z.number().nonnegative().default(0),
  sourceOutMs: z.number().nonnegative().nullable().default(null),
  timelineStartMs: z.number().nonnegative().default(0),
  timelineEndMs: z.number().nonnegative().nullable().default(null),
  enabled: z.boolean().default(true),
  speed: z.number().positive().default(1),
  reverse: z.boolean().default(false),
  volume: z.number().min(0).max(2).default(1),
  transform: TransformSchema.default({}),
  linkedClipId: UuidSchema.nullable().default(null),
  groupId: UuidSchema.nullable().default(null),
  effects: z.array(EffectInstanceSchema).default([]),
  transitionIn: TransitionInstanceSchema.nullable().default(null),
  transitionOut: TransitionInstanceSchema.nullable().default(null),
  text: TextStyleSchema.nullable().default(null),
  shape: ShapeStyleSchema.nullable().default(null),
  mask: MaskFoundationSchema.default({}),
  blendMode: z
    .enum(["normal", "multiply", "screen", "overlay"])
    .default("normal"),
  /** propertyPath → keyframes */
  keyframes: z.record(z.array(KeyframeSchema)).default({}),
  label: z.string().max(200).nullable().default(null),
});

export const TrackSchema = z.object({
  id: UuidSchema,
  type: z.enum(["video", "audio", "caption", "overlay", "text", "graphics", "adjustment"]),
  name: z.string().min(1).max(200),
  enabled: z.boolean().default(true),
  locked: z.boolean().default(false),
  muted: z.boolean().default(false),
  solo: z.boolean().default(false),
  visible: z.boolean().default(true),
  height: z.number().int().positive().default(48),
  colorLabel: z.string().max(32).nullable().default(null),
  clips: z.array(ClipSchema).default([]),
});

export const MarkerSchema = z.object({
  id: UuidSchema,
  timeMs: z.number().nonnegative(),
  name: z.string().min(1).max(200),
  category: z.string().max(64).default("marker"),
  color: z.string().max(32).nullable().default(null),
  note: z.string().max(2000).nullable().default(null),
});

export const SequenceSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(200),
  durationMs: z.number().nonnegative().default(0),
  frameRate: z.number().positive().default(30),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  sampleRate: z.number().int().positive().default(48000),
  backgroundColor: z.string().max(32).default("#000000"),
  tracks: z.array(TrackSchema).default([]),
  markers: z.array(MarkerSchema).default([]),
});

/** @deprecated Phase 1 stub — migrated into sequences[] in v2. */
export const TimelineStubSchema = z.object({
  version: z.literal(1),
  tracks: z.array(z.unknown()).default([]),
  durationMs: z.number().nonnegative().default(0),
});

export const ProjectSettingsSchema = z.object({
  frameRate: z.number().positive().default(30),
  width: z.number().int().positive().default(1920),
  height: z.number().int().positive().default(1080),
  sampleRate: z.number().int().positive().default(48000),
  locale: z.string().min(2).max(32).default("en-US"),
  previewQuality: z.enum(["performance", "balanced", "quality"]).default("balanced"),
  proxyMode: z.enum(["auto", "always", "never"]).default("auto"),
  defaultBackground: z.string().max(32).default("#000000"),
});

export const ProjectDocumentSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(300),
  schemaVersion: z.literal(CURRENT_PROJECT_SCHEMA_VERSION),
  workspaceId: z.string().min(1).max(128),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  lastSavedAt: IsoDateTimeSchema.nullable().default(null),
  appVersion: z.string().max(64).nullable().default(null),
  lastRecoveredAt: IsoDateTimeSchema.nullable().default(null),
  assets: z.array(ProjectAssetSchema).default([]),
  bins: z.array(MediaBinSchema).default([]),
  sequences: z.array(SequenceSchema).default([]),
  /** Retained for migration compatibility; prefer sequences. */
  timeline: TimelineStubSchema.optional(),
  settings: ProjectSettingsSchema.default({
    frameRate: 30,
    width: 1920,
    height: 1080,
    sampleRate: 48000,
    locale: "en-US",
    previewQuality: "balanced",
    proxyMode: "auto",
    defaultBackground: "#000000",
  }),
});

/** Loose document used only to read schemaVersion before migration. */
export const ProjectDocumentVersionProbeSchema = z
  .object({
    schemaVersion: z.number().int(),
  })
  .passthrough();

export type MediaAvailability = z.infer<typeof MediaAvailabilitySchema>;
export type MediaLocation = z.infer<typeof MediaLocationSchema>;
export type ProjectAsset = z.infer<typeof ProjectAssetSchema>;
export type MediaBin = z.infer<typeof MediaBinSchema>;
export type Transform = z.infer<typeof TransformSchema>;
export type Keyframe = z.infer<typeof KeyframeSchema>;
export type EffectInstance = z.infer<typeof EffectInstanceSchema>;
export type TransitionInstance = z.infer<typeof TransitionInstanceSchema>;
export type TextStyle = z.infer<typeof TextStyleSchema>;
export type ShapeStyle = z.infer<typeof ShapeStyleSchema>;
export type MaskFoundation = z.infer<typeof MaskFoundationSchema>;
export type Clip = z.infer<typeof ClipSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Marker = z.infer<typeof MarkerSchema>;
export type Sequence = z.infer<typeof SequenceSchema>;
export type TimelineStub = z.infer<typeof TimelineStubSchema>;
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;
export type ProjectDocument = z.infer<typeof ProjectDocumentSchema>;
