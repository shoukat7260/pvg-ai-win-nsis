import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, beforeEach } from "vitest";
import { AppRouter } from "@/app/router";
import { useAuthStore } from "@/auth/authStore";
import { useAppStore } from "@/state/appStore";
import { clearAccessToken } from "@/auth/tokenMemory";

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

describe("shell renders", () => {
  beforeEach(() => {
    clearAccessToken();
    useAuthStore.setState({
      status: "UNAUTHENTICATED",
      user: null,
      view: "login",
      error: null,
    });
    useAppStore.setState({
      currentWorkspace: null,
      currentProject: null,
      currentUser: null,
    });
  });

  it("renders splash branding", () => {
    renderAt("/");
    expect(screen.getByTestId("splash-screen")).toBeInTheDocument();
    expect(screen.getByText("PVG AI")).toBeInTheDocument();
    expect(screen.getByText("Product Generator AI")).toBeInTheDocument();
  });

  it("renders login screen", () => {
    renderAt("/login");
    expect(screen.getByTestId("login-screen")).toBeInTheDocument();
  });

  it("renders application shell when authenticated", async () => {
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
    renderAt("/app/home");
    expect(screen.getByText("Creative workstation foundation")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });
});
