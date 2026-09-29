import type { UserId } from "./uuid.js";

/** Auth bootstrap / session machine states (desktop + web). */
export type AuthStatus =
  | "UNKNOWN"
  | "AUTHENTICATING"
  | "AUTHENTICATED"
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED";

export const AUTH_STATUSES: readonly AuthStatus[] = Object.freeze([
  "UNKNOWN",
  "AUTHENTICATING",
  "AUTHENTICATED",
  "UNAUTHENTICATED",
  "SESSION_EXPIRED",
]);

export type AccountStatus =
  | "pending_verification"
  | "active"
  | "suspended"
  | "disabled"
  | "deleted";

export const ACCOUNT_STATUSES: readonly AccountStatus[] = Object.freeze([
  "pending_verification",
  "active",
  "suspended",
  "disabled",
  "deleted",
]);

export interface AuthUser {
  id: UserId;
  email: string;
  displayName: string;
  status: AccountStatus;
  emailVerified: boolean;
  mfaEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TokenPair {
  accessToken: string;
  /** Present for desktop; web may omit when refresh is cookie-bound. */
  refreshToken?: string | null;
  expiresIn?: number;
  tokenType?: "Bearer";
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceName?: string;
  deviceFingerprint?: string;
  platform?: string;
}

/** Successful password login — either tokens or MFA challenge. */
export type LoginResult =
  | ({ kind: "authenticated" } & TokenPair & { user: AuthUser })
  | {
      kind: "mfa_required";
      mfaChallengeId: string;
      methods: MfaMethodKind[];
    };

export interface SignupRequest {
  email: string;
  password: string;
  displayName: string;
}

export interface SignupResult {
  user: AuthUser;
  message?: string;
}

export type MfaMethodKind = "totp" | "recovery_code";

export interface MfaChallengeRequest {
  mfaChallengeId: string;
  method: MfaMethodKind;
  code: string;
}

export interface PasswordChangeRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
}

export interface VerifyEmailRequest {
  token: string;
}

export interface DesktopAuthStartRequest {
  /** PKCE code challenge (S256). */
  codeChallenge: string;
  codeChallengeMethod?: "S256";
  deviceName?: string;
  redirectUri?: string;
}

export interface DesktopAuthStartResponse {
  authorizeUrl: string;
  state: string;
  expiresAt?: string;
}

export interface DesktopAuthPollRequest {
  state: string;
  codeVerifier: string;
}

export type DesktopAuthPollResult =
  | { status: "pending" }
  | { status: "expired" | "denied"; message?: string }
  | ({ status: "completed" } & TokenPair & { user: AuthUser });

export interface DeviceRecord {
  id: string;
  publicId?: string;
  name: string;
  platform: string;
  osVersion?: string | null;
  appVersion?: string | null;
  architecture?: string | null;
  trusted: boolean;
  current: boolean;
  lastSeenAt: string | null;
  lastIp?: string | null;
  createdAt: string;
  revokedAt?: string | null;
}

export type SessionStatus = "active" | "revoked" | "expired";

export interface SessionRecord {
  id: string;
  deviceId: string | null;
  deviceName?: string | null;
  status: SessionStatus;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string | null;
  ip?: string | null;
  userAgent?: string | null;
  current: boolean;
  createdFrom?: string | null;
}

export interface SecurityActivityItem {
  id: string;
  eventType: string;
  summary: string;
  createdAt: string;
  ip?: string | null;
  userAgent?: string | null;
}

export interface MfaStatus {
  enabled: boolean;
  methods: MfaMethodKind[];
  recoveryCodesRemaining: number;
}

export interface MfaEnableStartResponse {
  secret: string;
  otpauthUrl: string;
  /** QR payload as data URL when server provides one. */
  qrDataUrl?: string | null;
}

export interface MfaEnableConfirmRequest {
  code: string;
}

export interface MfaRecoveryCodesResponse {
  codes: string[];
  generatedAt: string;
}

export type ConnectionMethod = "API_KEY" | "OAUTH" | "TOKEN" | "SERVICE_ACCOUNT";

export type ProviderConnectionScope = "user" | "device" | "workspace";

export interface ProviderConnectionSummary {
  id: string;
  providerType: string;
  displayName: string;
  status: "disconnected" | "connected" | "error" | "pending";
  method: ConnectionMethod;
  scope: ProviderConnectionScope;
  /** Vault / cloud reference only — never the raw secret. */
  credentialRef: string | null;
  secretHint: string | null;
  lastCheckedAt: string | null;
  lastValidatedAt: string | null;
  deviceId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PlanTier = "FREE" | "CREATOR" | "PRO" | "AGENCY";

export type SubscriptionStatus =
  | "none"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "sandbox";

export interface PlanSummary {
  id: string;
  tier: PlanTier;
  name: string;
  description?: string | null;
  features: string[];
}

export interface BillingSummary {
  plan: PlanSummary;
  status: SubscriptionStatus;
  renewsAt: string | null;
  trialEndsAt: string | null;
  /** Sandbox-only upgrade actions when API returns them — never fake live payments. */
  sandboxActions?: BillingSandboxAction[] | null;
}

export interface BillingSandboxAction {
  id: string;
  label: string;
  targetTier: PlanTier;
  description?: string | null;
}

export interface DeactivateAccountRequest {
  password: string;
  reason?: string;
}

export interface DeleteAccountRequest {
  password: string;
  confirmation: "DELETE";
  reason?: string;
}

export function isAuthStatus(value: unknown): value is AuthStatus {
  return (
    typeof value === "string" &&
    (AUTH_STATUSES as readonly string[]).includes(value)
  );
}

export function isAccountStatus(value: unknown): value is AccountStatus {
  return (
    typeof value === "string" &&
    (ACCOUNT_STATUSES as readonly string[]).includes(value)
  );
}
