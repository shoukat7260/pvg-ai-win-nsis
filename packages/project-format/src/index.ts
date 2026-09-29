export { CURRENT_PROJECT_SCHEMA_VERSION } from "./version.js";
export type { ProjectSchemaVersion } from "./version.js";

export {
  ProjectFormatError,
  ProjectCorrupt,
  ProjectInvalid,
  UnsupportedSchemaVersion,
  MissingReference,
  DuplicateId,
  type ProjectFormatErrorCode,
} from "./errors.js";

export {
  RelativePathSchema,
  MediaAvailabilitySchema,
  MediaLocationSchema,
  VideoMetadataSchema,
  AudioMetadataSchema,
  ImageMetadataSchema,
  DerivativeRefSchema,
  ProjectAssetSchema,
  MediaBinSchema,
  TransformSchema,
  KeyframeInterpolationSchema,
  KeyframeSchema,
  EffectInstanceSchema,
  TransitionInstanceSchema,
  TextStyleSchema,
  ShapeStyleSchema,
  MaskFoundationSchema,
  ClipSchema,
  TrackSchema,
  MarkerSchema,
  SequenceSchema,
  TimelineStubSchema,
  ProjectSettingsSchema,
  ProjectDocumentSchema,
  ProjectDocumentVersionProbeSchema,
  type MediaAvailability,
  type MediaLocation,
  type ProjectAsset,
  type MediaBin,
  type Transform,
  type Keyframe,
  type EffectInstance,
  type TransitionInstance,
  type TextStyle,
  type ShapeStyle,
  type MaskFoundation,
  type Clip,
  type Track,
  type Marker,
  type Sequence,
  type TimelineStub,
  type ProjectSettings,
  type ProjectDocument,
} from "./schema.js";

export { assertProjectIntegrity } from "./integrity.js";

export {
  MigrationRegistry,
  defaultMigrationRegistry,
  type MigrationFn,
  type MigrationStep,
} from "./migrate.js";

export {
  validateProject,
  loadProject,
  saveProject,
  migrateProject,
  type ValidateProjectOptions,
  type LoadProjectOptions,
} from "./project.js";

export {
  framesToMs,
  msToFrames,
  formatTimecode,
  parseTimecode,
} from "./timecode.js";
