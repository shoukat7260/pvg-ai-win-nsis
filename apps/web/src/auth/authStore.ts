import { create } from "zustand";
import type { AuthStatus, AuthUser, MfaMethodKind } from "@pvg/types";
import { getApiClient } from "./api";
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "./tokenMemory";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  mfaChallengeId: string | null;
  mfaMethods: MfaMethodKind[];
  error: string | null;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<"ok" | "mfa">;
  signup: (
    email: string,
    password: string,
    displayName: string,
  ) => Promise<void>;
  submitMfa: (method: MfaMethodKind, code: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

/**
 * Auth store — not persisted. Tokens never enter Zustand.
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  status: "UNKNOWN",
  user: null,
  mfaChallengeId: null,
  mfaMethods: [],
  error: null,

  clearError: () => set({ error: null }),

  bootstrap: async () => {
    set({ status: "AUTHENTICATING", error: null });
    try {
      if (!getAccessToken() && import.meta.env.VITE_AUTH_COOKIE_MODE !== "true") {
        set({ status: "UNAUTHENTICATED", user: null });
        return;
      }
      // Cookie mode: try refresh then /me; bearer mode: /me if access present.
      if (!getAccessToken() && import.meta.env.VITE_AUTH_COOKIE_MODE === "true") {
        try {
          const refreshed = await getApiClient().refresh();
          if (refreshed.accessToken) setAccessToken(refreshed.accessToken);
        } catch {
          set({ status: "UNAUTHENTICATED", user: null });
          return;
        }
      }
      if (!getAccessToken()) {
        set({ status: "UNAUTHENTICATED", user: null });
        return;
      }
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
      });
    } catch {
      clearAccessToken();
      set({ status: "SESSION_EXPIRED", user: null });
    }
  },

  login: async (email, password) => {
    set({ status: "AUTHENTICATING", error: null });
    try {
      const { getWebDeviceFingerprint, getWebDeviceName } = await import(
        "./deviceFingerprint"
      );
      const result = await getApiClient().login({
        email,
        password,
        deviceName: getWebDeviceName(),
        deviceFingerprint: getWebDeviceFingerprint(),
        platform: "web",
      });
      if (result.kind === "mfa_required") {
        set({
          status: "AUTHENTICATING",
          mfaChallengeId: result.mfaChallengeId,
          mfaMethods: result.methods,
        });
        return "mfa";
      }
      setAccessToken(result.accessToken);
      const me = result.user?.email
        ? result.user
        : ((await getApiClient().getMe()) as unknown as AuthUser);
      set({
        status: "AUTHENTICATED",
        user: me,
        mfaChallengeId: null,
      });
      return "ok";
    } catch (err) {
      set({
        status: "UNAUTHENTICATED",
        error: err instanceof Error ? err.message : "Login failed",
      });
      throw err;
    }
  },

  signup: async (email, password, displayName) => {
    set({ error: null });
    await getApiClient().signup({ email, password, displayName });
  },

  submitMfa: async (method, code) => {
    const id = get().mfaChallengeId;
    if (!id) throw new Error("No MFA challenge");
    const result = await getApiClient().completeMfaChallenge({
      mfaChallengeId: id,
      method,
      code: code.trim(),
    });
    setAccessToken(result.accessToken);
    set({
      status: "AUTHENTICATED",
      user: result.user,
      mfaChallengeId: null,
      mfaMethods: [],
    });
  },

  logout: async () => {
    try {
      await getApiClient().logout();
    } catch {
      /* best effort */
    }
    clearAccessToken();
    set({
      status: "UNAUTHENTICATED",
      user: null,
      mfaChallengeId: null,
      mfaMethods: [],
      error: null,
    });
  },
}));
