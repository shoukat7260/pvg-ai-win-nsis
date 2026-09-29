/**
 * Thin adapters for Phase 2 API payloads.
 * Backend may emit snake_case or camelCase; normalize to camelCase DTOs.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function pick<T>(
  obj: Record<string, unknown>,
  camel: string,
  snake: string,
): T | undefined {
  if (camel in obj) return obj[camel] as T;
  if (snake in obj) return obj[snake] as T;
  return undefined;
}

export function adaptAuthUser(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const emailVerifiedAt = pick<string | null>(
    raw,
    "emailVerifiedAt",
    "email_verified_at",
  );
  const emailVerified =
    pick<boolean>(raw, "emailVerified", "email_verified") ??
    (emailVerifiedAt != null && emailVerifiedAt !== "");
  return {
    id: pick(raw, "id", "id"),
    email: pick(raw, "email", "email"),
    displayName: pick(raw, "displayName", "display_name") ?? "",
    status: pick(raw, "status", "status"),
    emailVerified,
    mfaEnabled: pick(raw, "mfaEnabled", "mfa_enabled") ?? false,
    createdAt: pick(raw, "createdAt", "created_at"),
    updatedAt: pick(raw, "updatedAt", "updated_at"),
  };
}

export function adaptTokenPair(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  return {
    accessToken: pick(raw, "accessToken", "access_token"),
    refreshToken: pick(raw, "refreshToken", "refresh_token") ?? null,
    expiresIn: pick(raw, "expiresIn", "expires_in"),
    tokenType: pick(raw, "tokenType", "token_type") ?? "Bearer",
  };
}

export function adaptLoginResult(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const challengeId =
    pick<string>(raw, "mfaChallengeId", "mfa_challenge_id") ??
    pick<string>(raw, "challengeId", "challenge_id");
  const mfaRequired =
    pick<boolean>(raw, "mfaRequired", "mfa_required") === true ||
    Boolean(challengeId && !pick(raw, "accessToken", "access_token"));
  const kind =
    pick<string>(raw, "kind", "kind") ??
    (mfaRequired
      ? "mfa_required"
      : pick(raw, "accessToken", "access_token")
        ? "authenticated"
        : undefined);

  if (kind === "mfa_required") {
    return {
      kind: "mfa_required",
      mfaChallengeId: challengeId,
      methods: pick(raw, "methods", "methods") ?? ["totp", "recovery_code"],
    };
  }

  if (kind === "authenticated" || pick(raw, "accessToken", "access_token")) {
    const userRaw = pick(raw, "user", "user");
    return {
      kind: "authenticated",
      ...adaptTokenPair(raw),
      user: userRaw ? adaptAuthUser(userRaw) : undefined,
    };
  }

  return raw;
}

export function adaptDesktopStart(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  return {
    authorizeUrl: pick(raw, "authorizeUrl", "authorize_url"),
    state: pick(raw, "state", "state"),
    expiresAt: pick(raw, "expiresAt", "expires_at"),
  };
}

export function adaptDesktopPoll(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const status = pick<string>(raw, "status", "status") ?? "pending";
  if (status === "completed") {
    return {
      status: "completed",
      ...adaptTokenPair(raw),
      user: adaptAuthUser(pick(raw, "user", "user") ?? {}),
    };
  }
  return {
    status,
    message: pick(raw, "message", "message"),
  };
}

export function adaptBilling(raw: unknown): unknown {
  if (!isRecord(raw)) return raw;
  const planRaw = pick<Record<string, unknown>>(raw, "plan", "plan") ?? {};
  return {
    plan: {
      id: pick(planRaw, "id", "id"),
      tier: pick(planRaw, "tier", "tier") ?? pick(planRaw, "code", "code"),
      name: pick(planRaw, "name", "name"),
      description: pick(planRaw, "description", "description") ?? null,
      features: pick(planRaw, "features", "features") ?? [],
    },
    status: pick(raw, "status", "status"),
    renewsAt:
      pick(raw, "renewsAt", "renews_at") ??
      pick(raw, "currentPeriodEnd", "current_period_end") ??
      null,
    trialEndsAt: pick(raw, "trialEndsAt", "trial_ends_at") ?? null,
    sandboxActions:
      pick(raw, "sandboxActions", "sandbox_actions") ?? null,
  };
}

export function unwrapItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (isRecord(raw) && Array.isArray(raw.items)) return raw.items;
  return [];
}

export function adaptDevice(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  return {
    id: String(pick(raw, "id", "id") ?? ""),
    publicId: pick(raw, "publicId", "device_public_id"),
    name: pick(raw, "name", "name") ?? "Device",
    platform: pick(raw, "platform", "platform") ?? "unknown",
    osVersion: pick(raw, "osVersion", "os_version") ?? null,
    appVersion: pick(raw, "appVersion", "app_version") ?? null,
    architecture: pick(raw, "architecture", "architecture") ?? null,
    trusted: pick(raw, "trusted", "trusted") ?? false,
    current: pick(raw, "current", "current") ?? false,
    lastSeenAt: pick(raw, "lastSeenAt", "last_seen_at") ?? null,
    lastIp: pick(raw, "lastIp", "last_ip") ?? null,
    createdAt: pick(raw, "createdAt", "created_at") ?? "",
    revokedAt: pick(raw, "revokedAt", "revoked_at") ?? null,
    status: pick(raw, "status", "status"),
  };
}

export function adaptSession(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  return {
    id: String(pick(raw, "id", "id") ?? ""),
    deviceId: pick(raw, "deviceId", "device_id")
      ? String(pick(raw, "deviceId", "device_id"))
      : null,
    deviceName: pick(raw, "deviceName", "device_name") ?? null,
    status: pick(raw, "status", "status") ?? "active",
    createdAt: pick(raw, "createdAt", "created_at") ?? "",
    lastSeenAt: pick(raw, "lastSeenAt", "last_seen_at") ?? null,
    expiresAt: pick(raw, "expiresAt", "expires_at") ?? null,
    ip: pick(raw, "ip", "ip_address") ?? null,
    userAgent: pick(raw, "userAgent", "user_agent") ?? null,
    current: pick(raw, "current", "current") ?? false,
    createdFrom: pick(raw, "createdFrom", "created_from") ?? null,
  };
}

export function adaptConnection(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  const methodRaw = String(
    pick(raw, "method", "connection_method") ?? "API_KEY",
  ).toUpperCase();
  return {
    id: String(pick(raw, "id", "id") ?? ""),
    providerType: pick(raw, "providerType", "provider_type") ?? "other",
    displayName: pick(raw, "displayName", "display_name") ?? "",
    status: pick(raw, "status", "status") ?? "disconnected",
    method: methodRaw === "API_KEY" ? "API_KEY" : methodRaw,
    scope: pick(raw, "scope", "scope") ?? "user",
    credentialRef: pick(raw, "credentialRef", "credential_ref") ?? null,
    secretHint: pick(raw, "secretHint", "secret_hint") ??
      pick(raw, "accountLabel", "account_label") ??
      null,
    lastCheckedAt: pick(raw, "lastCheckedAt", "last_checked_at") ?? null,
    lastValidatedAt: pick(raw, "lastValidatedAt", "last_validated_at") ?? null,
    deviceId: pick(raw, "deviceId", "device_id")
      ? String(pick(raw, "deviceId", "device_id"))
      : null,
    createdAt: pick(raw, "createdAt", "created_at") ?? "",
    updatedAt: pick(raw, "updatedAt", "updated_at") ?? "",
  };
}

export function adaptSecurityActivity(raw: unknown): Record<string, unknown> {
  if (!isRecord(raw)) return {};
  return {
    id: String(pick(raw, "id", "id") ?? ""),
    eventType: pick(raw, "eventType", "event_type") ?? "unknown",
    summary: pick(raw, "summary", "message") ?? "",
    createdAt: pick(raw, "createdAt", "created_at") ?? "",
    ip: pick(raw, "ip", "ip_address") ?? null,
    userAgent: pick(raw, "userAgent", "user_agent") ?? null,
  };
}
