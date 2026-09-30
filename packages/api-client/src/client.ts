import type {
  AuthUser,
  BillingSandboxAction,
  BillingSummary,
  DeactivateAccountRequest,
  DeleteAccountRequest,
  DesktopAuthPollRequest,
  DesktopAuthPollResult,
  DesktopAuthStartRequest,
  DesktopAuthStartResponse,
  DeviceRecord,
  ForgotPasswordRequest,
  LoginRequest,
  LoginResult,
  MfaChallengeRequest,
  MfaEnableConfirmRequest,
  MfaEnableStartResponse,
  MfaRecoveryCodesResponse,
  MfaStatus,
  PasswordChangeRequest,
  Project,
  ProviderConnectionSummary,
  ResetPasswordRequest,
  SecurityActivityItem,
  SessionRecord,
  SignupRequest,
  SignupResult,
  TokenPair,
  User,
  VerifyEmailRequest,
  Workspace,
} from "@pvg/types";
import { ApiClientError, createRequestId, parseApiError } from "./errors.js";
import {
  adaptAuthUser,
  adaptBilling,
  adaptConnection,
  adaptDesktopPoll,
  adaptDesktopStart,
  adaptDevice,
  adaptLoginResult,
  adaptSecurityActivity,
  adaptSession,
  adaptTokenPair,
  unwrapItems,
} from "./adapters.js";

export interface PvgApiClientOptions {
  /** Origin only, e.g. http://localhost:8000 */
  baseUrl: string;
  /** Defaults to /api/v1 */
  apiPrefix?: string;
  /** Optional bearer token getter (access token in memory). */
  getAccessToken?: () => string | null | Promise<string | null>;
  /**
   * SPA cookie mode: send credentials (cookies) on same-site API calls.
   * Prefer when the backend sets HttpOnly refresh cookies.
   * Documented in apps/web README — never store refresh in localStorage.
   */
  credentials?: RequestCredentials;
  /** Inject custom fetch (tests). */
  fetch?: typeof fetch;
  /** Default headers merged into every request. */
  defaultHeaders?: Record<string, string>;
}

export interface HealthResponse {
  status: "ok";
  version?: string;
}

export interface ReadyResponse {
  status: "ready" | "not_ready";
  checks?: Record<string, { ok: boolean; detail?: string }>;
}

export interface RequestOptions {
  /** Override / generate request id for X-Request-Id. */
  requestId?: string;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class PvgApiClient {
  readonly baseUrl: string;
  readonly apiPrefix: string;
  private readonly getAccessToken?: PvgApiClientOptions["getAccessToken"];
  private readonly fetchImpl: typeof fetch;
  private readonly defaultHeaders: Record<string, string>;
  private readonly credentials: RequestCredentials;

  constructor(options: PvgApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/$/, "");
    this.apiPrefix = options.apiPrefix ?? "/api/v1";
    this.getAccessToken = options.getAccessToken;
    this.fetchImpl =
      options.fetch ??
      ((input: RequestInfo | URL, init?: RequestInit) =>
        globalThis.fetch(input, init));
    this.defaultHeaders = { ...options.defaultHeaders };
    this.credentials = options.credentials ?? "same-origin";
  }

  private url(path: string): string {
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${this.baseUrl}${this.apiPrefix}${p}`;
  }

  async request<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions & { body?: unknown } = {},
  ): Promise<T> {
    const requestId = options.requestId ?? createRequestId();
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Request-Id": requestId,
      ...this.defaultHeaders,
      ...options.headers,
    };

    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const token = this.getAccessToken
      ? await this.getAccessToken()
      : null;
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await this.fetchImpl(this.url(path), {
      method,
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
      credentials: this.credentials,
    });

    if (!response.ok) {
      const apiError = await parseApiError(response, requestId);
      throw new ApiClientError(apiError, response.status);
    }

    if (response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  // ── Health ──────────────────────────────────────────────────────────

  getMe(options?: RequestOptions): Promise<User> {
    return this.request<unknown>("GET", "/me", options).then(
      (raw) => adaptAuthUser(raw) as unknown as User,
    );
  }

  updateMe(
    body: { displayName?: string; email?: string },
    options?: RequestOptions,
  ): Promise<AuthUser> {
    return this.request<unknown>("PATCH", "/account", {
      ...options,
      body: {
        displayName: body.displayName,
        display_name: body.displayName,
        email: body.email,
      },
    }).then((raw) => adaptAuthUser(raw) as unknown as AuthUser);
  }

  listWorkspaces(options?: RequestOptions): Promise<Workspace[]> {
    return this.request<Workspace[]>("GET", "/workspaces", options);
  }

  getWorkspace(workspaceId: string, options?: RequestOptions): Promise<Workspace> {
    return this.request<Workspace>("GET", `/workspaces/${workspaceId}`, options);
  }

  listProjects(
    workspaceId: string,
    options?: RequestOptions,
  ): Promise<Project[]> {
    return this.request<Project[]>(
      "GET",
      `/workspaces/${workspaceId}/projects`,
      options,
    );
  }

  getProject(
    workspaceId: string,
    projectId: string,
    options?: RequestOptions,
  ): Promise<Project> {
    return this.request<Project>(
      "GET",
      `/workspaces/${workspaceId}/projects/${projectId}`,
      options,
    );
  }

  health(options?: RequestOptions): Promise<HealthResponse> {
    return this.request<HealthResponse>("GET", "/health", options);
  }

  ready(options?: RequestOptions): Promise<ReadyResponse> {
    return this.request<ReadyResponse>("GET", "/ready", options);
  }

  // ── Auth ────────────────────────────────────────────────────────────

  async signup(
    body: SignupRequest,
    options?: RequestOptions,
  ): Promise<SignupResult> {
    const raw = await this.request<unknown>("POST", "/auth/register", {
      ...options,
      body: {
        email: body.email,
        password: body.password,
        displayName: body.displayName,
        display_name: body.displayName,
      },
    });
    return {
      user: adaptAuthUser(raw) as unknown as AuthUser,
      message: "Account created. Check your email to verify.",
    };
  }

  async login(
    body: LoginRequest,
    options?: RequestOptions,
  ): Promise<LoginResult> {
    const raw = await this.request<unknown>("POST", "/auth/login", {
      ...options,
      body: {
        email: body.email,
        password: body.password,
        deviceName: body.deviceName,
        device_name: body.deviceName,
        deviceFingerprint: body.deviceFingerprint,
        device_fingerprint: body.deviceFingerprint,
        platform: body.platform,
      },
    });
    return adaptLoginResult(raw) as LoginResult;
  }

  async logout(options?: RequestOptions): Promise<void> {
    await this.request<void>("POST", "/auth/logout", options);
  }

  async refresh(
    body?: { refreshToken?: string },
    options?: RequestOptions,
  ): Promise<TokenPair & { user?: AuthUser }> {
    const refreshToken = body?.refreshToken;
    const raw = await this.request<unknown>("POST", "/auth/refresh", {
      ...options,
      body: refreshToken
        ? { refreshToken, refresh_token: refreshToken }
        : {},
    });
    const tokens = adaptTokenPair(raw);
    const userRaw =
      raw && typeof raw === "object" && "user" in raw
        ? (raw as { user: unknown }).user
        : undefined;
    return {
      ...(tokens as unknown as TokenPair),
      user: userRaw
        ? (adaptAuthUser(userRaw) as unknown as AuthUser)
        : undefined,
    };
  }

  forgotPassword(
    body: ForgotPasswordRequest,
    options?: RequestOptions,
  ): Promise<{ message?: string }> {
    return this.request("POST", "/auth/request-password-reset", {
      ...options,
      body: { email: body.email },
    });
  }

  resetPassword(
    body: ResetPasswordRequest,
    options?: RequestOptions,
  ): Promise<{ message?: string }> {
    return this.request("POST", "/auth/reset-password", {
      ...options,
      body: {
        token: body.token,
        newPassword: body.newPassword,
        new_password: body.newPassword,
      },
    });
  }

  verifyEmail(
    body: VerifyEmailRequest,
    options?: RequestOptions,
  ): Promise<{ status: "verified" | "expired" | "invalid"; message?: string }> {
    return this.request("POST", "/auth/verify-email", { ...options, body });
  }

  resendVerification(
    body: { email: string },
    options?: RequestOptions,
  ): Promise<{ message?: string }> {
    return this.request("POST", "/auth/resend-verification", {
      ...options,
      body,
    });
  }

  async completeMfaChallenge(
    body: MfaChallengeRequest,
    options?: RequestOptions,
  ): Promise<TokenPair & { user: AuthUser }> {
    const raw = await this.request<unknown>("POST", "/auth/mfa/challenge/verify", {
      ...options,
      body: {
        mfaChallengeId: body.mfaChallengeId,
        challenge_id: body.mfaChallengeId,
        method: body.method,
        totp_code: body.method === "totp" ? body.code : undefined,
        recovery_code: body.method === "recovery_code" ? body.code : undefined,
        code: body.code,
      },
    });
    return {
      ...(adaptTokenPair(raw) as unknown as TokenPair),
      user: adaptAuthUser(
        raw && typeof raw === "object" && "user" in raw
          ? (raw as { user: unknown }).user
          : {},
      ) as unknown as AuthUser,
    };
  }

  async desktopAuthStart(
    body: DesktopAuthStartRequest,
    options?: RequestOptions,
  ): Promise<DesktopAuthStartResponse> {
    const raw = await this.request<unknown>("POST", "/auth/desktop/start", {
      ...options,
      body: {
        codeChallenge: body.codeChallenge,
        code_challenge: body.codeChallenge,
        codeChallengeMethod: body.codeChallengeMethod ?? "S256",
        code_challenge_method: body.codeChallengeMethod ?? "S256",
        deviceName: body.deviceName,
        device_name: body.deviceName,
        redirectUri: body.redirectUri,
        redirect_uri: body.redirectUri,
      },
    });
    return adaptDesktopStart(raw) as unknown as DesktopAuthStartResponse;
  }

  async desktopAuthPoll(
    body: DesktopAuthPollRequest,
    options?: RequestOptions,
  ): Promise<DesktopAuthPollResult> {
    const raw = await this.request<unknown>("POST", "/auth/desktop/poll", {
      ...options,
      body: {
        state: body.state,
        codeVerifier: body.codeVerifier,
        code_verifier: body.codeVerifier,
      },
    });
    return adaptDesktopPoll(raw) as DesktopAuthPollResult;
  }

  /** Alternate exchange endpoint if backend uses /complete instead of /poll. */
  async desktopAuthComplete(
    body: DesktopAuthPollRequest & { code?: string },
    options?: RequestOptions,
  ): Promise<DesktopAuthPollResult> {
    const raw = await this.request<unknown>("POST", "/auth/desktop/complete", {
      ...options,
      body: {
        state: body.state,
        codeVerifier: body.codeVerifier,
        code_verifier: body.codeVerifier,
        code: body.code,
      },
    });
    return adaptDesktopPoll(raw) as DesktopAuthPollResult;
  }

  // ── Account / security ──────────────────────────────────────────────

  changePassword(
    body: PasswordChangeRequest,
    options?: RequestOptions,
  ): Promise<void> {
    return this.request("POST", "/account/password", {
      ...options,
      body: {
        currentPassword: body.currentPassword,
        current_password: body.currentPassword,
        newPassword: body.newPassword,
        new_password: body.newPassword,
      },
    });
  }

  requestDeactivate(
    body: DeactivateAccountRequest,
    options?: RequestOptions,
  ): Promise<{ status: string; message?: string }> {
    return this.request("POST", "/me/deactivate", { ...options, body });
  }

  requestDelete(
    body: DeleteAccountRequest,
    options?: RequestOptions,
  ): Promise<{ status: string; message?: string }> {
    return this.request("POST", "/me/delete-request", { ...options, body });
  }

  getMfaStatus(options?: RequestOptions): Promise<MfaStatus> {
    return this.request("GET", "/me/mfa", options);
  }

  startMfaEnable(options?: RequestOptions): Promise<MfaEnableStartResponse> {
    return this.request("POST", "/me/mfa/enable/start", options);
  }

  confirmMfaEnable(
    body: MfaEnableConfirmRequest,
    options?: RequestOptions,
  ): Promise<MfaRecoveryCodesResponse> {
    return this.request("POST", "/me/mfa/enable/confirm", {
      ...options,
      body,
    });
  }

  disableMfa(
    body: { password: string; code?: string },
    options?: RequestOptions,
  ): Promise<void> {
    return this.request("POST", "/me/mfa/disable", { ...options, body });
  }

  regenerateRecoveryCodes(
    body: { password: string; code?: string },
    options?: RequestOptions,
  ): Promise<MfaRecoveryCodesResponse> {
    return this.request("POST", "/me/mfa/recovery-codes", {
      ...options,
      body,
    });
  }

  listDevices(options?: RequestOptions): Promise<DeviceRecord[]> {
    return this.request<unknown>("GET", "/devices", options).then((raw) =>
      unwrapItems(raw).map((item) => adaptDevice(item) as unknown as DeviceRecord),
    );
  }

  revokeDevice(deviceId: string, options?: RequestOptions): Promise<void> {
    return this.request("POST", `/devices/${deviceId}/revoke`, options);
  }

  listSessions(options?: RequestOptions): Promise<SessionRecord[]> {
    return this.request<unknown>("GET", "/sessions", options).then((raw) =>
      unwrapItems(raw).map((item) => adaptSession(item) as unknown as SessionRecord),
    );
  }

  revokeSession(sessionId: string, options?: RequestOptions): Promise<void> {
    return this.request("POST", `/sessions/${sessionId}/revoke`, options);
  }

  revokeOtherSessions(options?: RequestOptions): Promise<{ revoked: number }> {
    return this.request("POST", "/sessions/revoke-others", options);
  }

  listSecurityActivity(
    options?: RequestOptions,
  ): Promise<SecurityActivityItem[]> {
    return this.request<unknown>("GET", "/account/security-events", options).then(
      (raw) =>
        unwrapItems(raw).map(
          (item) => adaptSecurityActivity(item) as unknown as SecurityActivityItem,
        ),
    );
  }

  // ── Connections ─────────────────────────────────────────────────────

  listConnections(
    options?: RequestOptions,
  ): Promise<ProviderConnectionSummary[]> {
    return this.request<unknown>("GET", "/connections", options).then((raw) =>
      unwrapItems(raw).map(
        (item) => adaptConnection(item) as unknown as ProviderConnectionSummary,
      ),
    );
  }

  connectProvider(
    body: {
      providerType: string;
      displayName?: string;
      method?: string;
      credentialRef?: string;
      secretHint?: string;
    },
    options?: RequestOptions,
  ): Promise<ProviderConnectionSummary> {
    return this.request<unknown>("POST", "/connections", {
      ...options,
      body: {
        provider_type: body.providerType,
        display_name: body.displayName ?? body.providerType,
        connection_method: (body.method ?? "API_KEY").toLowerCase(),
        credential_ref: body.credentialRef,
        account_label: body.secretHint,
      },
    }).then((raw) => adaptConnection(raw) as unknown as ProviderConnectionSummary);
  }

  testConnection(
    connectionId: string,
    options?: RequestOptions,
  ): Promise<ProviderConnectionSummary> {
    return this.listConnections(options).then((items) => {
      const found = items.find((c) => c.id === connectionId);
      if (!found) throw new Error("Connection not found");
      return found;
    });
  }

  refreshConnection(
    connectionId: string,
    options?: RequestOptions,
  ): Promise<ProviderConnectionSummary> {
    return this.request<unknown>("PATCH", `/connections/${connectionId}`, {
      ...options,
      body: { status: "connected" },
    }).then((raw) => adaptConnection(raw) as unknown as ProviderConnectionSummary);
  }

  disconnectConnection(
    connectionId: string,
    options?: RequestOptions,
  ): Promise<void> {
    return this.request("DELETE", `/connections/${connectionId}`, options);
  }

  // ── Billing ─────────────────────────────────────────────────────────

  async getBilling(options?: RequestOptions): Promise<BillingSummary> {
    const [subRaw, plansRaw, entitlementsRaw] = await Promise.all([
      this.request<unknown>("GET", "/billing/subscription", options),
      this.request<unknown>("GET", "/billing/plans", options),
      this.request<unknown>("GET", "/billing/entitlements", options).catch(
        () => [],
      ),
    ]);

    const sub = (subRaw ?? {}) as Record<string, unknown>;
    const plans = Array.isArray(plansRaw) ? plansRaw : unwrapItems(plansRaw);
    const planId = String(sub.plan_id ?? sub.planId ?? "");
    const matched =
      plans.find((p) => isRecord(p) && String(p.id) === planId) ??
      plans[0] ??
      {};
    const plan = isRecord(matched) ? matched : {};
    const entitlements = Array.isArray(entitlementsRaw)
      ? entitlementsRaw
      : unwrapItems(entitlementsRaw);
    const features = entitlements
      .map((e) => {
        if (!isRecord(e)) return null;
        const key = e.feature_key ?? e.featureKey;
        const limit = e.limit_value ?? e.limitValue ?? e.feature_value;
        return key ? `${key}: ${limit}` : null;
      })
      .filter((f): f is string => Boolean(f));

    const code = String(plan.code ?? "FREE").toUpperCase();
    const sandboxActions = plans
      .filter((p) => isRecord(p) && String(p.code).toUpperCase() !== "FREE")
      .map((p) => {
        const row = p as Record<string, unknown>;
        const tier = String(row.code ?? "").toUpperCase();
        return {
          id: `checkout:${tier}`,
          label: `Upgrade to ${row.name ?? tier}`,
          targetTier: tier,
          description: row.description ? String(row.description) : null,
        };
      });

    return adaptBilling({
      plan: {
        id: plan.id,
        tier: code,
        code,
        name: plan.name ?? code,
        description: plan.description ?? null,
        features,
      },
      status: sub.status ?? "active",
      renews_at: sub.current_period_end ?? sub.currentPeriodEnd ?? null,
      sandbox_actions: sandboxActions,
    }) as BillingSummary;
  }

  runSandboxBillingAction(
    actionId: string,
    options?: RequestOptions,
  ): Promise<BillingSummary> {
    const planCode = actionId.startsWith("checkout:")
      ? actionId.slice("checkout:".length)
      : actionId;
    return this.request<unknown>("POST", "/billing/checkout", {
      ...options,
      body: { plan_code: planCode, planCode },
    }).then(() => this.getBilling(options));
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function createApiClient(options: PvgApiClientOptions): PvgApiClient {
  return new PvgApiClient(options);
}

export type { BillingSandboxAction };
