import { create } from "zustand";
import type { AuthStatus, AuthUser, MfaMethodKind } from "@pvg/types";
import { getApiClient } from "./api";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "./tokenMemory";
import { createPkcePair } from "./pkce";
import { vaultService } from "@/services/vault";
import { nativeApi } from "@/services/tauri";

export type AuthView =
  | "login"
  | "waiting_browser"
  | "mfa"
  | "browser_failed";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  view: AuthView;
  error: string | null;
  mfaChallengeId: string | null;
  mfaMethods: MfaMethodKind[];
  browserState: string | null;
  codeVerifier: string | null;
  bootstrap: () => Promise<void>;
  loginWithPassword: (email: string, password: string) => Promise<void>;
  submitMfa: (method: MfaMethodKind, code: string) => Promise<void>;
  startBrowserLogin: () => Promise<void>;
  cancelBrowserLogin: () => void;
  retryBrowserLogin: () => Promise<void>;
  logout: () => Promise<void>;
  setView: (view: AuthView) => void;
  clearError: () => void;
}

async function applyTokens(access: string, refresh?: string | null, user?: AuthUser) {
  setAccessToken(access);
  if (refresh) {
    await vaultService.storeSessionRefresh(refresh);
  }
  return user;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "UNKNOWN",
  user: null,
  view: "login",
  error: null,
  mfaChallengeId: null,
  mfaMethods: [],
  browserState: null,
  codeVerifier: null,

  setView: (view) => set({ view }),
  clearError: () => set({ error: null }),

  bootstrap: async () => {
    set({ status: "AUTHENTICATING", error: null });
    try {
      const hasRefresh = await vaultService.hasSessionRefresh();
      if (!hasRefresh && !getAccessToken()) {
        set({ status: "UNAUTHENTICATED", user: null, view: "login" });
        return;
      }
      // Refresh credential stays in vault; native path may later inject.
      // Attempt /me if we already have an in-memory access token.
      if (getAccessToken()) {
        const me = await getApiClient().getMe();
        set({
          status: "AUTHENTICATED",
          user: {
            id: me.id as AuthUser["id"],
            email: me.email,
            displayName: me.displayName,
            status: (me.status as AuthUser["status"]) || "active",
            emailVerified: me.emailVerified ?? true,
            mfaEnabled: me.mfaEnabled ?? false,
            createdAt: me.createdAt,
            updatedAt: me.updatedAt,
          },
          view: "login",
        });
        return;
      }
      set({ status: "UNAUTHENTICATED", user: null, view: "login" });
    } catch {
      clearAccessToken();
      set({
        status: "SESSION_EXPIRED",
        user: null,
        view: "login",
        error: "Session expired — please sign in again.",
      });
    }
  },

  loginWithPassword: async (email, password) => {
    set({ status: "AUTHENTICATING", error: null });
    try {
      const result = await getApiClient().login({
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
      setAccessToken(result.accessToken);
      if (result.refreshToken) {
        await vaultService.storeSessionRefresh(result.refreshToken);
      }
      const me = result.user?.email
        ? result.user
        : ((await getApiClient().getMe()) as unknown as AuthUser);
      set({
        status: "AUTHENTICATED",
        user: me ?? null,
        view: "login",
        mfaChallengeId: null,
      });
    } catch (err) {
      set({
        status: "UNAUTHENTICATED",
        error: err instanceof Error ? err.message : "Sign-in failed",
        view: "login",
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
      const result = await getApiClient().completeMfaChallenge({
        mfaChallengeId: challengeId,
        method,
        code: code.trim(),
      });
      const user = await applyTokens(
        result.accessToken,
        result.refreshToken,
        result.user,
      );
      set({
        status: "AUTHENTICATED",
        user: user ?? null,
        view: "login",
        mfaChallengeId: null,
        mfaMethods: [],
      });
    } catch (err) {
      set({
        status: "AUTHENTICATING",
        error: err instanceof Error ? err.message : "MFA verification failed",
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
      const { codeVerifier, codeChallenge } = await createPkcePair();
      const start = await getApiClient().desktopAuthStart({
        codeChallenge,
        codeChallengeMethod: "S256",
        deviceName: "PVG Desktop",
      });
      if (!start.authorizeUrl || !start.state) {
        throw new Error("Invalid desktop auth start response");
      }
      set({ browserState: start.state, codeVerifier });
      await nativeApi.openExternalUrl(start.authorizeUrl);

      // Poll until completed / expired / cancelled.
      const poll = async () => {
        const { browserState, codeVerifier: verifier, view } = get();
        if (view !== "waiting_browser" || !browserState || !verifier) return;
        try {
          const result = await getApiClient().desktopAuthPoll({
            state: browserState,
            codeVerifier: verifier,
          });
          if (result.status === "pending") {
            window.setTimeout(() => void poll(), 2000);
            return;
          }
          if (result.status === "completed") {
            const user = await applyTokens(
              result.accessToken,
              result.refreshToken,
              result.user,
            );
            set({
              status: "AUTHENTICATED",
              user: user ?? null,
              view: "login",
              browserState: null,
              codeVerifier: null,
            });
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
            error: err instanceof Error ? err.message : "Browser sign-in failed",
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
        error: err instanceof Error ? err.message : "Could not start browser sign-in",
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
    });
  },
}));
