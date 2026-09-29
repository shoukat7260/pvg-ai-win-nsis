import { describe, expect, it, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppRouter } from "@/app/router";
import { useAuthStore } from "@/auth/authStore";
import { resetApiClient } from "@/auth/api";
import { clearAccessToken, setAccessToken } from "@/auth/tokenMemory";
import { usePrefsStore } from "@/state/prefsStore";
import { SignupRequestSchema, LoginRequestSchema, scorePasswordStrength } from "@pvg/schemas";

function renderApp(path: string) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <AppRouter />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("auth form validation", () => {
  it("rejects weak signup client-side", () => {
    const bad = SignupRequestSchema.safeParse({
      email: "not-an-email",
      password: "short",
      displayName: "",
    });
    expect(bad.success).toBe(false);
    expect(scorePasswordStrength("abc").label).toBe("too short");
    expect(scorePasswordStrength("Abcdef12!x").score).toBeGreaterThan(1);
  });

  it("accepts valid login shape", () => {
    expect(
      LoginRequestSchema.safeParse({
        email: "user@example.com",
        password: "password123",
      }).success,
    ).toBe(true);
  });

  it("shows signup strength feedback", async () => {
    useAuthStore.setState({ status: "UNAUTHENTICATED", user: null });
    renderApp("/signup");
    const pwd = screen.getByTestId("signup-password");
    await userEvent.type(pwd, "abc");
    expect(screen.getByTestId("password-strength")).toHaveTextContent("too short");
  });
});

describe("route guards", () => {
  beforeEach(() => {
    clearAccessToken();
    resetApiClient();
    useAuthStore.setState({
      status: "UNAUTHENTICATED",
      user: null,
      mfaChallengeId: null,
      error: null,
    });
  });

  it("redirects unauthenticated users away from dashboard", () => {
    renderApp("/dashboard");
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
    expect(screen.getByTestId("login-form")).toBeInTheDocument();
  });

  it("does not flash dashboard while authenticating", () => {
    useAuthStore.setState({ status: "AUTHENTICATING" });
    renderApp("/dashboard");
    expect(screen.queryByTestId("dashboard")).not.toBeInTheDocument();
    expect(screen.getByTestId("auth-bootstrapping")).toBeInTheDocument();
  });

  it("shows dashboard when authenticated", () => {
    setAccessToken("test-access");
    useAuthStore.setState({
      status: "AUTHENTICATED",
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000" as never,
        email: "a@b.co",
        displayName: "Ada",
        status: "active",
        emailVerified: true,
        mfaEnabled: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    renderApp("/dashboard");
    expect(screen.getByTestId("dashboard")).toBeInTheDocument();
  });
});

describe("connections screen", () => {
  beforeEach(() => {
    resetApiClient();
    useAuthStore.setState({
      status: "AUTHENTICATED",
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000" as never,
        email: "a@b.co",
        displayName: "Ada",
        status: "active",
        emailVerified: true,
        mfaEnabled: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
  });

  it("renders empty/disconnected provider cards", async () => {
    renderApp("/settings/connections");
    expect(await screen.findByTestId("settings-connections")).toBeInTheDocument();
    expect(screen.getByTestId("provider-card-elevenlabs")).toBeInTheDocument();
    expect(
      await screen.findByText(/No providers connected/i),
    ).toBeInTheDocument();
  });

  it("renders connected state when API returns connections", async () => {
    resetApiClient();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/connections")) {
          return new Response(
            JSON.stringify({
              items: [
                {
                  id: "550e8400-e29b-41d4-a716-446655440001",
                  provider_type: "elevenlabs",
                  display_name: "ElevenLabs",
                  status: "connected",
                  connection_method: "api_key",
                  account_label: "••••abcd",
                  credential_ref: "provider.elevenlabs",
                  workspace_id: null,
                  user_id: null,
                  device_id: null,
                  last_validated_at: null,
                },
              ],
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    renderApp("/settings/connections");
    expect(await screen.findByText(/••••abcd/)).toBeInTheDocument();
    expect(screen.queryByText(/No providers connected/i)).not.toBeInTheDocument();
  });
});

describe("billing display", () => {
  beforeEach(() => {
    resetApiClient();
    useAuthStore.setState({
      status: "AUTHENTICATED",
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000" as never,
        email: "a@b.co",
        displayName: "Ada",
        status: "active",
        emailVerified: true,
        mfaEnabled: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
  });

  it("shows plan from API", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/billing/subscription")) {
          return new Response(
            JSON.stringify({
              id: "sub-1",
              plan_id: "free",
              status: "active",
              current_period_start: null,
              current_period_end: null,
              cancel_at_period_end: false,
            }),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("/billing/plans")) {
          return new Response(
            JSON.stringify([
              {
                id: "free",
                code: "FREE",
                name: "Free",
                description: "Personal starter",
                price_cents: 0,
                currency: "USD",
                billing_interval: "month",
              },
              {
                id: "creator",
                code: "CREATOR",
                name: "Creator",
                description: "Independent creators",
                price_cents: 1900,
                currency: "USD",
                billing_interval: "month",
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("/billing/entitlements")) {
          return new Response(
            JSON.stringify([
              { feature_key: "projects", feature_value: "3", limit_value: 3 },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    renderApp("/settings/billing");
    expect(await screen.findByTestId("billing-plan-name")).toHaveTextContent("Free");
    expect(screen.getByTestId("billing-sandbox-actions")).toBeInTheDocument();
  });
});

describe("logout clears state", () => {
  it("clears access token and auth status", async () => {
    setAccessToken("secret-token");
    useAuthStore.setState({
      status: "AUTHENTICATED",
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000" as never,
        email: "a@b.co",
        displayName: "Ada",
        status: "active",
        emailVerified: true,
        mfaEnabled: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await useAuthStore.getState().logout();
    const { getAccessToken } = await import("@/auth/tokenMemory");
    expect(getAccessToken()).toBeNull();
    expect(useAuthStore.getState().status).toBe("UNAUTHENTICATED");
    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe("no secrets in persisted zustand", () => {
  it("prefs persist excludes tokens", () => {
    setAccessToken("must-not-persist");
    usePrefsStore.getState().setBannerDismissed(true);
    const raw = localStorage.getItem("pvg-web-prefs");
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("must-not-persist");
    expect(raw).not.toContain("accessToken");
    expect(raw).not.toContain("refresh");
  });
});
