export type ConnectivityMode =
  | "LOCAL_ONLY"
  | "ONLINE_OPTIONAL"
  | "ONLINE_REQUIRED";

export type AppRouteId =
  | "splash"
  | "login"
  | "home"
  | "media"
  | "settings"
  | "security"
  | "about";

export interface CurrentUser {
  id: string;
  displayName: string;
  isFoundationPlaceholder: boolean;
}

export interface CurrentWorkspace {
  id: string;
  displayName: string;
  projectsRoot: string;
  dataRoot: string;
}

export interface ProjectMetadata {
  id: string;
  name: string;
  path: string;
  workspaceId: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  description: string;
}

export type ProxyModePreference = "auto" | "proxy" | "original";
export type PreviewQualityPreference = "performance" | "balanced" | "quality";

export interface AppSettings {
  theme: "charcoal";
  reduceMotion: boolean;
  showDisabledNav: boolean;
  diagnosticsVerbose: boolean;
  /** Preferred media preview source when opening assets. */
  proxyMode: ProxyModePreference;
  /** Display preference for preview quality (local UX only). */
  previewQuality: PreviewQualityPreference;
}

export type {
  MediaAsset,
  MediaAssetKind,
  MediaAssetStatus,
  MediaImportMode,
  MediaImportResult,
  MediaEngineStatus,
  MediaSortKey,
  MediaTypeFilter,
  PreviewSource,
  ProbeResult,
  ProjectAssetDto,
  JobSnapshot,
  JobType,
  JobState,
  JobStage,
  StorageSummary,
  AutosaveEntry,
  AutosaveWriteResult,
} from "./media";

export {
  toMediaAsset,
  deriveAssetStatus,
  normalizeAssetKind,
} from "./media";

export interface ConnectionMetadata {
  mode: ConnectivityMode;
  apiBaseUrl: string | null;
  lastCheckedAt: string | null;
  reachable: boolean | null;
}

export interface DiagnosticsReport {
  appName: string;
  appVersion: string;
  phase: string;
  os: string;
  arch: string;
  rustcChannel: string;
  dataRoot: string;
  workspaceRoot: string;
  connectivityHint: string;
  vaultBackend: string;
  notes: string[];
}

export interface VaultCredentialMeta {
  keyId: string;
  label: string;
  updatedAtMs: number;
}

export interface LocalWorkspaceInfo {
  workspaceId: string;
  displayName: string;
  dataRoot: string;
  projectsRoot: string;
  userId: string;
}

export interface ProgressEvent {
  operationId: string;
  stage: string;
  percent: number;
  message: string;
  done: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "charcoal",
  reduceMotion: false,
  showDisabledNav: true,
  diagnosticsVerbose: false,
  proxyMode: "auto",
  previewQuality: "balanced",
};
