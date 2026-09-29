import { z } from "zod";

/** UUID string (RFC 4122 variant bits loosely enforced). */
export const UuidSchema = z
  .string()
  .uuid({ message: "Must be a valid UUID" });

export const IsoDateTimeSchema = z
  .string()
  .datetime({ offset: true, message: "Must be an ISO-8601 datetime" });

export const WorkspaceRoleSchema = z.enum([
  "OWNER",
  "ADMIN",
  "EDITOR",
  "CREATOR",
  "REVIEWER",
  "VIEWER",
]);

export const ProviderTypeSchema = z.enum([
  "elevenlabs",
  "google_veo",
  "runway",
  "kling",
  "fal",
  "openrouter",
  "other",
]);

export const ConnectionStatusSchema = z.enum([
  "disconnected",
  "connected",
  "error",
  "pending",
]);

export const ConnectivityModeSchema = z.enum([
  "LOCAL_ONLY",
  "ONLINE_OPTIONAL",
  "ONLINE_REQUIRED",
]);

export const AuthStatusSchema = z.enum([
  "UNKNOWN",
  "AUTHENTICATING",
  "AUTHENTICATED",
  "UNAUTHENTICATED",
  "SESSION_EXPIRED",
]);

export const AccountStatusSchema = z.enum([
  "pending_verification",
  "active",
  "suspended",
  "disabled",
  "deleted",
]);

export const UserStatusSchema = z.enum([
  "active",
  "disabled",
  "pending",
  "pending_verification",
  "suspended",
  "deleted",
]);

export const UserSchema = z.object({
  id: UuidSchema,
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  status: UserStatusSchema,
  emailVerified: z.boolean().optional(),
  mfaEnabled: z.boolean().optional(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const AuthUserSchema = z.object({
  id: UuidSchema,
  email: z.string().email(),
  displayName: z.string().min(1).max(200),
  status: AccountStatusSchema,
  emailVerified: z.boolean(),
  mfaEnabled: z.boolean(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const EmailSchema = z.string().email().max(320);

export const PasswordSchema = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password must be at most 128 characters");

export const LoginRequestSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1).max(128),
  deviceName: z.string().max(200).optional(),
});

export const SignupRequestSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  displayName: z.string().min(1).max(200),
});

export const MfaMethodKindSchema = z.enum(["totp", "recovery_code"]);

export const MfaChallengeRequestSchema = z.object({
  mfaChallengeId: z.string().min(1).max(200),
  method: MfaMethodKindSchema,
  code: z.string().min(1).max(64),
});

export const PasswordChangeRequestSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: PasswordSchema,
});

export const ForgotPasswordRequestSchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordRequestSchema = z.object({
  token: z.string().min(1).max(512),
  newPassword: PasswordSchema,
});

export const VerifyEmailRequestSchema = z.object({
  token: z.string().min(1).max(512),
});

export const DesktopAuthStartRequestSchema = z.object({
  codeChallenge: z.string().min(43).max(128),
  codeChallengeMethod: z.literal("S256").optional(),
  deviceName: z.string().max(200).optional(),
  redirectUri: z.string().url().optional(),
});

export const DesktopAuthPollRequestSchema = z.object({
  state: z.string().min(1).max(200),
  codeVerifier: z.string().min(43).max(128),
});

export const DeviceRecordSchema = z.object({
  id: UuidSchema,
  publicId: z.string().optional(),
  name: z.string().min(1).max(200),
  platform: z.string().min(1).max(100),
  osVersion: z.string().max(100).nullable().optional(),
  appVersion: z.string().max(100).nullable().optional(),
  architecture: z.string().max(100).nullable().optional(),
  trusted: z.boolean(),
  current: z.boolean(),
  lastSeenAt: IsoDateTimeSchema.nullable(),
  lastIp: z.string().max(100).nullable().optional(),
  createdAt: IsoDateTimeSchema,
  revokedAt: IsoDateTimeSchema.nullable().optional(),
});

export const SessionRecordSchema = z.object({
  id: UuidSchema,
  deviceId: UuidSchema.nullable(),
  deviceName: z.string().max(200).nullable().optional(),
  status: z.enum(["active", "revoked", "expired"]),
  createdAt: IsoDateTimeSchema,
  lastSeenAt: IsoDateTimeSchema.nullable(),
  expiresAt: IsoDateTimeSchema.nullable(),
  ip: z.string().max(100).nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
  current: z.boolean(),
  createdFrom: z.string().max(100).nullable().optional(),
});

export const SecurityActivityItemSchema = z.object({
  id: UuidSchema,
  eventType: z.string().min(1).max(100),
  summary: z.string().min(1).max(500),
  createdAt: IsoDateTimeSchema,
  ip: z.string().max(100).nullable().optional(),
  userAgent: z.string().max(500).nullable().optional(),
});

export const MfaStatusSchema = z.object({
  enabled: z.boolean(),
  methods: z.array(MfaMethodKindSchema),
  recoveryCodesRemaining: z.number().int().nonnegative(),
});

export const ConnectionMethodSchema = z.enum([
  "API_KEY",
  "OAUTH",
  "TOKEN",
  "SERVICE_ACCOUNT",
]);

export const ProviderConnectionSummarySchema = z.object({
  id: UuidSchema,
  providerType: z.string().min(1),
  displayName: z.string().min(1).max(200),
  status: ConnectionStatusSchema,
  method: ConnectionMethodSchema,
  scope: z.enum(["user", "device", "workspace"]),
  credentialRef: z.string().max(500).nullable(),
  secretHint: z.string().max(32).nullable(),
  lastCheckedAt: IsoDateTimeSchema.nullable(),
  lastValidatedAt: IsoDateTimeSchema.nullable(),
  deviceId: UuidSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const PlanTierSchema = z.enum(["FREE", "CREATOR", "PRO", "AGENCY"]);

export const SubscriptionStatusSchema = z.enum([
  "none",
  "trialing",
  "active",
  "past_due",
  "canceled",
  "sandbox",
]);

export const PlanSummarySchema = z.object({
  id: z.string().min(1),
  tier: PlanTierSchema,
  name: z.string().min(1),
  description: z.string().max(2000).nullable().optional(),
  features: z.array(z.string()),
});

export const BillingSandboxActionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  targetTier: PlanTierSchema,
  description: z.string().max(500).nullable().optional(),
});

export const BillingSummarySchema = z.object({
  plan: PlanSummarySchema,
  status: SubscriptionStatusSchema,
  renewsAt: IsoDateTimeSchema.nullable(),
  trialEndsAt: IsoDateTimeSchema.nullable(),
  sandboxActions: z.array(BillingSandboxActionSchema).nullable().optional(),
});

export const WorkspaceSchema = z.object({
  id: UuidSchema,
  name: z.string().min(1).max(200),
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Invalid slug"),
  ownerId: UuidSchema,
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const ProjectSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  name: z.string().min(1).max(300),
  description: z.string().max(4000).nullable(),
  status: z.enum(["draft", "active", "archived"]),
  schemaVersion: z.number().int().positive(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const AssetSchema = z.object({
  id: UuidSchema,
  projectId: UuidSchema,
  kind: z.enum(["image", "video", "audio", "caption", "thumbnail", "other"]),
  name: z.string().min(1).max(500),
  relativePath: z.string().min(1).max(2000),
  mimeType: z.string().max(200).nullable(),
  byteSize: z.number().int().nonnegative().nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const GenerationJobSchema = z.object({
  id: UuidSchema,
  projectId: UuidSchema,
  workspaceId: UuidSchema,
  providerType: ProviderTypeSchema,
  status: z.enum(["queued", "running", "succeeded", "failed", "cancelled"]),
  prompt: z.string().max(20000).nullable(),
  errorMessage: z.string().max(4000).nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
  completedAt: IsoDateTimeSchema.nullable(),
});

export const ProviderConnectionSchema = z.object({
  id: UuidSchema,
  workspaceId: UuidSchema,
  providerType: ProviderTypeSchema,
  displayName: z.string().min(1).max(200),
  status: ConnectionStatusSchema,
  credentialRef: z.string().max(500).nullable(),
  lastCheckedAt: IsoDateTimeSchema.nullable(),
  createdAt: IsoDateTimeSchema,
  updatedAt: IsoDateTimeSchema,
});

export const ApiErrorDetailSchema = z.object({
  field: z.string().optional(),
  code: z.string().optional(),
  message: z.string(),
});

export const ApiErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  details: z.array(ApiErrorDetailSchema).optional(),
  request_id: z.string().min(1),
  status: z.number().int().optional(),
});

export const DiagnosticCheckSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  level: z.enum(["ok", "warn", "error", "unknown"]),
  message: z.string(),
  checkedAt: IsoDateTimeSchema,
});

export const DiagnosticsSchema = z.object({
  appVersion: z.string().min(1),
  platform: z.string().min(1),
  connectivityMode: ConnectivityModeSchema,
  online: z.boolean(),
  checks: z.array(DiagnosticCheckSchema),
  collectedAt: IsoDateTimeSchema,
});

export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  version: z.string().optional(),
});

export const ReadyResponseSchema = z.object({
  status: z.enum(["ready", "not_ready"]),
  checks: z
    .record(z.object({ ok: z.boolean(), detail: z.string().optional() }))
    .optional(),
});

/**
 * Client-side password strength (advisory only — server is authoritative).
 */
export function scorePasswordStrength(password: string): {
  score: 0 | 1 | 2 | 3 | 4;
  label: "too short" | "weak" | "fair" | "good" | "strong";
} {
  if (password.length < 10) return { score: 0, label: "too short" };
  let score = 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  const clamped = Math.min(4, score) as 0 | 1 | 2 | 3 | 4;
  const labels = ["too short", "weak", "fair", "good", "strong"] as const;
  return { score: clamped, label: labels[clamped] };
}

export type UserInput = z.infer<typeof UserSchema>;
export type AuthUserInput = z.infer<typeof AuthUserSchema>;
export type WorkspaceInput = z.infer<typeof WorkspaceSchema>;
export type ProjectInput = z.infer<typeof ProjectSchema>;
export type AssetInput = z.infer<typeof AssetSchema>;
export type GenerationJobInput = z.infer<typeof GenerationJobSchema>;
export type ProviderConnectionInput = z.infer<typeof ProviderConnectionSchema>;
export type ApiErrorInput = z.infer<typeof ApiErrorSchema>;
export type DiagnosticsInput = z.infer<typeof DiagnosticsSchema>;
export type BillingSummaryInput = z.infer<typeof BillingSummarySchema>;
export type DeviceRecordInput = z.infer<typeof DeviceRecordSchema>;
export type SessionRecordInput = z.infer<typeof SessionRecordSchema>;
