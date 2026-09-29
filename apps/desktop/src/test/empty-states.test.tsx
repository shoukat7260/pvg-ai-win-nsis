import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { AppRouter } from "@/app/router";
import { useAuthStore } from "@/auth/authStore";
import { useAppStore } from "@/state/appStore";

const authedUser = {
  id: "550e8400-e29b-41d4-a716-446655440000" as never,
  email: "a@b.co",
  displayName: "Ada",
  status: "active" as const,
  emailVerified: true,
  mfaEnabled: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("empty states", () => {
  beforeEach(() => {
    useAuthStore.setState({ status: "AUTHENTICATED", user: authedUser });
    useAppStore.setState({
      currentWorkspace: null,
      currentProject: null,
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
  });

  it("shows empty workspace state on home", () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/app/home"]}>
          <AppRouter />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No local workspace yet");
  });

  it("shows empty connections state", async () => {
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/app/settings/connections"]}>
          <AppRouter />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByText(/No providers connected/i)).toBeInTheDocument();
  });
});
