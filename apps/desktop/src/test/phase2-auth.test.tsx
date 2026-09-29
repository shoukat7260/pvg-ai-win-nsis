import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { AppRouter } from "@/app/router";
import { useAuthStore } from "@/auth/authStore";
import { resetApiClient } from "@/auth/api";
import { clearAccessToken, setAccessToken, getAccessToken } from "@/auth/tokenMemory";
import { useAppStore } from "@/state/appStore";
import { LoginRequestSchema, scorePasswordStrength } from "@pvg/schemas";

function renderAt(path: string) {
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

describe("desktop auth phase 2", () => {
  beforeEach(() => {
    clearAccessToken();
    resetApiClient();
    useAuthStore.setState({
      status: "UNAUTHENTICATED",
      user: null,
      view: "login",
      error: null,
      mfaChallengeId: null,
      mfaMethods: [],
    });
    useAppStore.setState({
      currentWorkspace: null,
      currentProject: null,
      currentUser: null,
    });
  });

  it("renders login form instead of foundation placeholder", () => {
    renderAt("/login");
    expect(screen.getByTestId("login-screen")).toBeInTheDocument();
    expect(screen.getByTestId("continue-browser")).toBeInTheDocument();
  });

  it("validates login client-side", () => {
    expect(LoginRequestSchema.safeParse({ email: "x", password: "" }).success).toBe(
      false,
    );
    expect(scorePasswordStrength("abcdefgh").label).toBe("too short");
    expect(scorePasswordStrength("Abcdef12!x").label).not.toBe("too short");
  });

  it("guards app routes until authenticated", async () => {
    renderAt("/app/home");
    expect(await screen.findByTestId("login-screen")).toBeInTheDocument();
    expect(screen.queryByText("Creative workstation foundation")).not.toBeInTheDocument();
  });

  it("shows user identity after auth", async () => {
    setAccessToken("tok");
    useAuthStore.setState({
      status: "AUTHENTICATED",
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000" as never,
        email: "creator@pvg.ai",
        displayName: "Creator",
        status: "active",
        emailVerified: true,
        mfaEnabled: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    renderAt("/app/home");
    expect(await screen.findByTestId("shell-user-identity")).toHaveTextContent(
      "creator@pvg.ai",
    );
  });

  it("logout clears in-memory access token", async () => {
    setAccessToken("desktop-secret");
    useAuthStore.setState({ status: "AUTHENTICATED", user: null });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 204 })),
    );
    await useAuthStore.getState().logout();
    expect(getAccessToken()).toBeNull();
    expect(useAuthStore.getState().status).toBe("UNAUTHENTICATED");
  });

  it("connections empty state", async () => {
    useAuthStore.setState({
      status: "AUTHENTICATED",
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000" as never,
        email: "a@b.co",
        displayName: "A",
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
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );
    renderAt("/app/settings/connections");
    expect(await screen.findByTestId("settings-connections")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/No providers connected/i)).toBeInTheDocument();
    });
  });

  it("billing display from mocked API", async () => {
    resetApiClient();
    useAuthStore.setState({
      status: "AUTHENTICATED",
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000" as never,
        email: "a@b.co",
        displayName: "A",
        status: "active",
        emailVerified: true,
        mfaEnabled: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/billing/subscription")) {
          return new Response(
            JSON.stringify({
              id: "sub-1",
              plan_id: "free",
              status: "sandbox",
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
                description: "Starter",
                price_cents: 0,
                currency: "USD",
                billing_interval: "month",
              },
            ]),
            { status: 200, headers: { "Content-Type": "application/json" } },
          );
        }
        if (url.includes("/billing/entitlements")) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ items: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }),
    );
    renderAt("/app/settings/billing");
    expect(await screen.findByTestId("billing-plan-name")).toHaveTextContent("Free");
  });

  it("persisted zustand omits tokens", () => {
    setAccessToken("never-store-me");
    useAppStore.getState().patchSettings({ reduceMotion: true });
    const raw = localStorage.getItem("pvg-app-foundation");
    expect(raw).toBeTruthy();
    expect(raw).not.toContain("never-store-me");
    expect(raw).not.toContain("accessToken");
  });

  it("settings preferences still toggles", async () => {
    const user = userEvent.setup();
    useAuthStore.setState({
      status: "AUTHENTICATED",
      user: {
        id: "550e8400-e29b-41d4-a716-446655440000" as never,
        email: "a@b.co",
        displayName: "A",
        status: "active",
        emailVerified: true,
        mfaEnabled: false,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    useAppStore.setState({
      appSettings: {
        theme: "charcoal",
        reduceMotion: false,
        showDisabledNav: true,
        diagnosticsVerbose: false,
        proxyMode: "auto",
        previewQuality: "balanced",
      },
    });
    renderAt("/app/settings/preferences");
    expect(screen.getByTestId("settings-shell")).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    await user.click(boxes[1]!);
    expect(useAppStore.getState().appSettings.reduceMotion).toBe(true);
  });
});
