import type {
  AssetId,
  GenerationJobId,
  ProjectId,
  ProviderConnectionId,
  UserId,
  WorkspaceId,
} from "./uuid.js";
import type { WorkspaceRole } from "./permissions.js";

/** @deprecated Prefer AccountStatus from auth.ts for Phase 2. */
export type UserStatus =
  | "active"
  | "disabled"
  | "pending"
  | "pending_verification"
  | "suspended"
  | "deleted";

export interface User {
  id: UserId;
  email: string;
  displayName: string;
  status: UserStatus;
  emailVerified?: boolean;
  mfaEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Workspace {
  id: WorkspaceId;
  name: string;
  slug: string;
  ownerId: UserId;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMembership {
  workspaceId: WorkspaceId;
  userId: UserId;
  role: WorkspaceRole;
  createdAt: string;
}

export type ProjectStatus = "draft" | "active" | "archived";

export interface Project {
  id: ProjectId;
  workspaceId: WorkspaceId;
  name: string;
  description: string | null;
  status: ProjectStatus;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export type AssetKind =
  | "image"
  | "video"
  | "audio"
  | "caption"
  | "thumbnail"
  | "other";

export interface Asset {
  id: AssetId;
  projectId: ProjectId;
  kind: AssetKind;
  name: string;
  /** Relative path inside the .pvg bundle (never an absolute host path in cloud metadata). */
  relativePath: string;
  mimeType: string | null;
  byteSize: number | null;
  createdAt: string;
  updatedAt: string;
}

export type GenerationJobStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface GenerationJob {
  id: GenerationJobId;
  projectId: ProjectId;
  workspaceId: WorkspaceId;
  providerType: ProviderType;
  status: GenerationJobStatus;
  prompt: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export type ProviderType =
  | "elevenlabs"
  | "google_veo"
  | "runway"
  | "kling"
  | "fal"
  | "openrouter"
  | "other";

export const PROVIDER_TYPES: readonly ProviderType[] = Object.freeze([
  "elevenlabs",
  "google_veo",
  "runway",
  "kling",
  "fal",
  "openrouter",
  "other",
]);

/** Display labels for settings connection cards. */
export const PROVIDER_DISPLAY_NAMES: Readonly<Record<ProviderType, string>> =
  Object.freeze({
    elevenlabs: "ElevenLabs",
    google_veo: "Google",
    runway: "Runway",
    kling: "Kling",
    fal: "fal.ai",
    openrouter: "OpenRouter",
    other: "Other",
  });

export type ConnectionStatus =
  | "disconnected"
  | "connected"
  | "error"
  | "pending";

export interface ProviderConnection {
  id: ProviderConnectionId;
  workspaceId: WorkspaceId;
  providerType: ProviderType;
  displayName: string;
  status: ConnectionStatus;
  /** Vault reference only — never the raw secret. */
  credentialRef: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function isProviderType(value: unknown): value is ProviderType {
  return (
    typeof value === "string" &&
    (PROVIDER_TYPES as readonly string[]).includes(value)
  );
}

export function isConnectionStatus(value: unknown): value is ConnectionStatus {
  return (
    typeof value === "string" &&
    ["disconnected", "connected", "error", "pending"].includes(value)
  );
}
