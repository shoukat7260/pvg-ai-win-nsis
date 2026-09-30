import { create } from "zustand";
import type { AuthStatus, AuthUser, MfaMethodKind } from "@pvg/types";
import { getApiClient, getApiClientAsync } from "./api";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "./tokenMemory";
import { createPkcePair } from "./pkce";
import { vaultService } from "@/services/vault";
import { nativeApi } from "@/services/tauri";
import { toSafeAuthError, toSafeSignupError } from "./safeAuthError";

export type AuthView =
  | "login"
  | "signup"
  | "waiting_browser"
  | "mfa"
  | "browser_failed";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  view: AuthView;
  error: string | null;
  info: string | null;
  mfaChallengeId: string | null;
  mfaMethods: MfaMethodKind[];
  browserState: string | null;
  codeVerifier: string | null;
  bootstrap: () => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  signupWithPassword: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  submitMfa: (method: MfaMethodKind, code: string) => Promise<void>;
  startBrowserLogin: () => Promise<void>;
  cancelBrowserLogin: () => void;
  retryBrowserLogin: () => Promise<void>;
  logout: () => Promise<void>;
  setView: (view: AuthView) => void;
  clearError: () => void;
}

function asAuthUser(raw: AuthUser | Record<string, unknown> | null | undefined): AuthUser | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!r.email && !(raw as AuthUser).email) return null;
  return {
    id: (raw as AuthUser).id ?? (r.id as AuthUser["id"]),
    email: String((raw as AuthUser).email ?? r.email ?? ""),
    displayName: String((raw as AuthUser).displayName ?? r.displayName ?? ""),
    status: ((raw as AuthUser).status ?? r.status ?? "active") as AuthUser["status"],
    emailVerified: Boolean((raw as AuthUser).emailVerified ?? r.emailVerified ?? false),
    mfaEnabled: Boolean((raw as AuthUser).mfaEnabled ?? r.mfaEnabled ?? false),
    createdAt: String((raw as AuthUser).createdAt ?? r.createdAt ?? ""),
    updatedAt: String((raw as AuthUser).updatedAt ?? r.updatedAt ?? ""),
  };
}

async function persistRefreshBestEffort(refresh?: string | null) {
  if (!refresh) return;
  try {
    await vaultService.storeSessionRefresh(refresh);
  } catch {
    // Vault/keyring must never abort an otherwise successful login.
  }
}

async function applyAuthenticated(
  set: (partial: Partial<AuthState>) => void,
  access: string,
  refresh: string | null | undefined,
  user: AuthUser | null,
) {
  setAccessToken(access);
  await persistRefreshBestEffort(refresh);
  set({
    status: "AUTHENTICATED",
    user,
    view: "login",
    error: null,
    mfaChallengeId: null,
    mfaMethods: [],
    browserState: null,
    codeVerifier: null,
  });
  // Post-AUTHENTICATED hook point — side effects prefer WorkspaceHome bootstrap toast.
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "UNKNOWN",
  user: null,
  view: "login",
  error: null,
  info: null,
  mfaChallengeId: null,
  mfaMethods: [],
  browserState: null,
  codeVerifier: null,

  setView: (view) => set({ view, error: null, info: null }),
  clearError: () => set({ error: null, info: null }),

  bootstrap: async () => {
    set({ status: "AUTHENTICATING", error: null });
    try {
      const api = await getApiClientAsync();

      if (getAccessToken()) {
        const me = await api.getMe();
        set({
          status: "AUTHENTICATED",
          user: asAuthUser(me as unknown as AuthUser),
          view: "login",
        });
        return;
      }

      const refresh = await vaultService.getSessionRefresh().catch(() => null);
      if (!refresh) {
        set({ status: "UNAUTHENTICATED", user: null, view: "login" });
        return;
      }

      const tokens = await api.refresh({ refreshToken: refresh });
      setAccessToken(tokens.accessToken);
      await persistRefreshBestEffort(tokens.refreshToken ?? refresh);
      const me =
        tokens.user ??
        ((await api.getMe()) as unknown as AuthUser);
      set({
        status: "AUTHENTICATED",
        user: asAuthUser(me),
        view: "login",
        error: null,
      });
    } catch {
      clearAccessToken();
      try {
        await vaultService.clearSessionRefresh();
      } catch {
        // ignore
      }
      set({
        status: "SESSION_EXPIRED",
        user: null,
        view: "login",
        error: "Session expired — please sign in again.",
      });
    }
  },

  loginWithPassword: async (email, password) => {
    set({ status: "AUTHENTICATING", error: null, info: null });
    try {
      const api = await getApiClientAsync();
      const result = await api.login({
        email,
        password,
        deviceName: "PVG Desktop",
      });
      if (result.kind === "mfa_required") {
        set({
          status: "AUTHENTICATING",
          view: "mfa",
          mfaChallengeId: result.mfaChallengeId,
          mfaMethods: result.methods,
        });
        return;
      }
      if (!result.accessToken) {
        throw new Error("Sign-in response was incomplete.");
      }
      setAccessToken(result.accessToken);
      await persistRefreshBestEffort(result.refreshToken);
      const me = result.user?.email
        ? asAuthUser(result.user)
        : asAuthUser((await api.getMe()) as unknown as AuthUser);
      set({
        status: "AUTHENTICATED",
        user: me,
        view: "login",
        mfaChallengeId: null,
        error: null,
      });
      // Post-AUTHENTICATED hook point (analytics / toasts). Prefer WorkspaceHome
      // "Workspace ready" toast over login success toasts — LoginScreen does not toast.
    } catch (err) {
      clearAccessToken();
      set({
        status: "UNAUTHENTICATED",
        error: toSafeAuthError(err),
        view: "login",
      });
    }
  },

  signupWithPassword: async (email, password, displayName) => {
    set({ status: "AUTHENTICATING", error: null, info: null });
    try {
      const api = await getApiClientAsync();
      await api.signup({ email, password, displayName });
      // Immediately sign in so desktop users land in Home (verification may still be pending).
      const result = await api.login({
        email,
        password,
        deviceName: "PVG Desktop",
      });
      if (result.kind === "mfa_required") {
        set({
          status: "AUTHENTICATING",
          view: "mfa",
          mfaChallengeId: result.mfaChallengeId,
          mfaMethods: result.methods,
          info: "Account created. Complete MFA to continue.",
        });
        return;
      }
      if (!result.accessToken) {
        set({
          status: "UNAUTHENTICATED",
          view: "login",
          info: "Account created. Sign in to continue.",
          error: null,
        });
        return;
      }
      setAccessToken(result.accessToken);
      await persistRefreshBestEffort(result.refreshToken);
      const me = result.user?.email
        ? asAuthUser(result.user)
        : asAuthUser((await api.getMe()) as unknown as AuthUser);
      set({
        status: "AUTHENTICATED",
        user: me,
        view: "login",
        info: me?.emailVerified
          ? null
          : "Account created. Check your email to verify when convenient.",
        error: null,
      });
      // Post-AUTHENTICATED hook point — Login/Signup screens do not toast success.
    } catch (err) {
      set({
        status: "UNAUTHENTICATED",
        view: "signup",
        error: toSafeSignupError(err),
      });
    }
  },

  submitMfa: async (method, code) => {
    const challengeId = get().mfaChallengeId;
    if (!challengeId) {
      set({ error: "No MFA challenge in progress", view: "login" });
      return;
    }
    set({ status: "AUTHENTICATING", error: null });
    try {
      const api = await getApiClientAsync();
      const result = await api.completeMfaChallenge({
        mfaChallengeId: challengeId,
        method,
        code: code.trim(),
      });
      await applyAuthenticated(
        set,
        result.accessToken,
        result.refreshToken,
        asAuthUser(result.user),
      );
    } catch (err) {
      set({
        status: "AUTHENTICATING",
        error: toSafeAuthError(err),
        view: "mfa",
      });
    }
  },

  startBrowserLogin: async () => {
    set({
      status: "AUTHENTICATING",
      view: "waiting_browser",
      error: null,
    });
    try {
      const api = await getApiClientAsync();
      const { codeVerifier, codeChallenge } = await createPkcePair();
      const start = await api.desktopAuthStart({
        codeChallenge,
        codeChallengeMethod: "S256",
        deviceName: "PVG Desktop",
      });
      if (!start.authorizeUrl || !start.state) {
        throw new Error("Invalid desktop auth start response");
      }
      set({ browserState: start.state, codeVerifier });
      await nativeApi.openExternalUrl(start.authorizeUrl);

      const poll = async () => {
        const { browserState, codeVerifier: verifier, view } = get();
        if (view !== "waiting_browser" || !browserState || !verifier) return;
        try {
          const result = await (await getApiClientAsync()).desktopAuthPoll({
            state: browserState,
            codeVerifier: verifier,
          });
          if (result.status === "pending") {
            window.setTimeout(() => void poll(), 2000);
            return;
          }
          if (result.status === "completed") {
            await applyAuthenticated(
              set,
              result.accessToken,
              result.refreshToken,
              asAuthUser(result.user),
            );
            return;
          }
          set({
            status: "UNAUTHENTICATED",
            view: "browser_failed",
            error: result.message ?? "Secure sign-in did not complete",
            browserState: null,
            codeVerifier: null,
          });
        } catch (err) {
          set({
            status: "UNAUTHENTICATED",
            view: "browser_failed",
            error: toSafeAuthError(err),
            browserState: null,
            codeVerifier: null,
          });
        }
      };
      window.setTimeout(() => void poll(), 1500);
    } catch (err) {
      set({
        status: "UNAUTHENTICATED",
        view: "browser_failed",
        error: toSafeAuthError(err),
      });
    }
  },

  cancelBrowserLogin: () => {
    set({
      status: "UNAUTHENTICATED",
      view: "login",
      browserState: null,
      codeVerifier: null,
      error: null,
    });
  },

  retryBrowserLogin: async () => {
    await get().startBrowserLogin();
  },

  logout: async () => {
    try {
      await getApiClient().logout();
    } catch {
      // Revoke best-effort; always clear local credentials.
    }
    clearAccessToken();
    try {
      await vaultService.clearSessionRefresh();
    } catch {
      // ignore vault clear failures on logout
    }
    set({
      status: "UNAUTHENTICATED",
      user: null,
      view: "login",
      mfaChallengeId: null,
      mfaMethods: [],
      browserState: null,
      codeVerifier: null,
      error: null,
      info: null,
    });
  },
}));
