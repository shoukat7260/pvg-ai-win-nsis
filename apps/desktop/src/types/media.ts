/** Phase 3 media / recovery view models — no secrets. */

export type MediaAssetKind = "video" | "audio" | "image" | "caption" | "other";

export type MediaImportMode = "link" | "copy";

export type MediaAssetStatus =
  | "IMPORTING"
  | "READY"
  | "MISSING"
  | "ERROR"
  | "PROXY_PENDING"
  | "PROXY_READY"
  | "PROXY_FAILED"
  | "OFFLINE"
  | "PROCESSING";

export type PreviewSource = "auto" | "proxy" | "original";

export type MediaSortKey = "name" | "kind" | "updatedAt" | "duration";

export type MediaTypeFilter = "all" | MediaAssetKind;

export type JobType = "import" | "probe" | "thumbnail" | "waveform" | "proxy";

export type JobState =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelRequested"
  | "cancelled";

export type JobStage =
  | "queued"
  | "starting"
  | "probing"
  | "processing"
  | "writing"
  | "finalizing"
  | "done"
  | "failed"
  | "cancelled";

export interface MediaLocationLink {
  mode: "link";
  absolutePath: string;
}

export interface MediaLocationCopy {
  mode: "copy";
  relativePath: string;
}

export type MediaLocation = MediaLocationLink | MediaLocationCopy;

export interface DerivativeRef {
  relativePath: string;
  engineVersion: string;
  createdAt: string;
  byteSize?: number | null;
}

export interface VideoMetadata {
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  frameRate?: number | null;
  codec?: string | null;
  container?: string | null;
  pixelFormat?: string | null;
  bitrate?: number | null;
  rotation?: number | null;
  hasAudio?: boolean;
}

export interface AudioMetadata {
  durationMs?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
  codec?: string | null;
  bitrate?: number | null;
  bitDepth?: number | null;
}

export interface ImageMetadata {
  width?: number | null;
  height?: number | null;
  format?: string | null;
  orientation?: number | null;
  hasAlpha?: boolean;
}

/** Raw asset shape returned by native media commands (camelCase). */
export interface ProjectAssetDto {
  id: string;
  kind: string;
  name: string;
  relativePath: string;
  location?: MediaLocation | null;
  mimeType?: string | null;
  byteSize?: number | null;
  sourceAssetId?: string | null;
  availability?: string;
  fingerprint?: string | null;
  video?: VideoMetadata | null;
  audio?: AudioMetadata | null;
  image?: ImageMetadata | null;
  thumbnail?: DerivativeRef | null;
  waveform?: DerivativeRef | null;
  proxy?: DerivativeRef | null;
  binId?: string | null;
  favorite?: boolean;
  createdAt: string;
  updatedAt: string;
}

/** UI view model derived from ProjectAssetDto. */
export interface MediaAsset {
  id: string;
  name: string;
  kind: MediaAssetKind;
  relativePath: string;
  sourcePath: string | null;
  sourcePolicy: MediaImportMode | null;
  mimeType: string | null;
  byteSize: number | null;
  availability: string;
  status: MediaAssetStatus;
  durationMs: number | null;
  width: number | null;
  height: number | null;
  codec: string | null;
  frameRate: number | null;
  hasProxy: boolean;
  hasThumbnail: boolean;
  hasWaveform: boolean;
  binId: string | null;
  favorite: boolean;
  createdAt: string;
  updatedAt: string;
  /** Original DTO for property panels / advanced actions. */
  raw: ProjectAssetDto;
}

export interface ProbeResult {
  width?: number | null;
  height?: number | null;
  durationSecs?: number | null;
  fps?: number | null;
  videoCodec?: string | null;
  audioCodec?: string | null;
  container?: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
  isImage: boolean;
}

export interface MediaImportResult {
  asset: ProjectAssetDto;
  jobIds: string[];
}

export interface JobProgress {
  stage: JobStage;
  fraction: number;
  message?: string | null;
}

export interface JobSnapshot {
  id: string;
  jobType: JobType;
  state: JobState;
  progress: JobProgress;
  error?: string | null;
  assetId?: string | null;
}

export interface StorageSummary {
  projectPath: string;
  totalBytes: number;
  mediaBytes: number;
  proxiesBytes: number;
  thumbnailsBytes: number;
  waveformsBytes: number;
  cacheBytes: number;
  otherBytes: number;
}

export interface MediaEngineStatus {
  ffmpegAvailable: boolean;
  ffprobeAvailable: boolean;
  ffmpegPath?: string | null;
  ffprobePath?: string | null;
  ffmpegVersion?: string | null;
  ffprobeVersion?: string | null;
}

export interface AutosaveEntry {
  name: string;
  path: string;
  modifiedMs?: number | null;
  byteSize: number;
}

export interface AutosaveWriteResult {
  path: string;
  name: string;
}

export function normalizeAssetKind(kind: string): MediaAssetKind {
  const k = kind.toLowerCase();
  if (k === "video" || k === "audio" || k === "image" || k === "caption") return k;
  return "other";
}

export function deriveAssetStatus(asset: ProjectAssetDto): MediaAssetStatus {
  const avail = (asset.availability ?? "available").toLowerCase();
  if (avail === "missing" || avail === "offline") {
    return avail === "offline" ? "OFFLINE" : "MISSING";
  }
  if (avail === "error" || avail === "failed") return "ERROR";
  if (avail === "importing") return "IMPORTING";
  if (avail === "processing" || avail === "probing") return "PROCESSING";
  if (asset.proxy) return "PROXY_READY";
  return "READY";
}

export function toMediaAsset(dto: ProjectAssetDto): MediaAsset {
  const kind = normalizeAssetKind(dto.kind);
  let sourcePath: string | null = null;
  let sourcePolicy: MediaImportMode | null = null;
  if (dto.location?.mode === "link") {
    sourcePath = dto.location.absolutePath;
    sourcePolicy = "link";
  } else if (dto.location?.mode === "copy") {
    sourcePath = dto.location.relativePath;
    sourcePolicy = "copy";
  } else if (dto.relativePath) {
    sourcePath = dto.relativePath;
  }

  const durationMs =
    dto.video?.durationMs ?? dto.audio?.durationMs ?? null;
  const width = dto.video?.width ?? dto.image?.width ?? null;
  const height = dto.video?.height ?? dto.image?.height ?? null;
  const codec =
    dto.video?.codec ?? dto.audio?.codec ?? dto.image?.format ?? null;

  return {
    id: dto.id,
    name: dto.name,
    kind,
    relativePath: dto.relativePath,
    sourcePath,
    sourcePolicy,
    mimeType: dto.mimeType ?? null,
    byteSize: dto.byteSize ?? null,
    availability: dto.availability ?? "available",
    status: deriveAssetStatus(dto),
    durationMs,
    width,
    height,
    codec,
    frameRate: dto.video?.frameRate ?? null,
    hasProxy: Boolean(dto.proxy),
    hasThumbnail: Boolean(dto.thumbnail),
    hasWaveform: Boolean(dto.waveform),
    binId: dto.binId ?? null,
    favorite: Boolean(dto.favorite),
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    raw: dto,
  };
}
