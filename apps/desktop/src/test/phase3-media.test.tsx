import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { AppRouter } from "@/app/router";
import { useAuthStore } from "@/auth/authStore";
import { useAppStore } from "@/state/appStore";
import { useMediaStore } from "@/state/mediaStore";
import { JobCenter } from "@/features/media/JobCenter";

const authedUser = {
  id: "550e8400-e29b-41d4-a716-446655440000" as never,
  email: "creator@pvg.ai",
  displayName: "Creator",
  status: "active" as const,
  emailVerified: true,
  mfaEnabled: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

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

describe("phase 3 media workspace", () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: "AUTHENTICATED",
      user: authedUser,
      view: "login",
      error: null,
      mfaChallengeId: null,
      mfaMethods: [],
    });
    useAppStore.setState({
      currentWorkspace: {
        id: "ws-local",
        displayName: "Local Test Workspace",
        projectsRoot: "/tmp/PVG/users/local/projects",
        dataRoot: "/tmp/PVG",
      },
      currentProject: null,
      appSettings: {
        theme: "charcoal",
        reduceMotion: false,
        showDisabledNav: true,
        diagnosticsVerbose: false,
        proxyMode: "auto",
        previewQuality: "balanced",
      },
    });
    useMediaStore.getState().reset();
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

  it("renders media route when authenticated", async () => {
    renderAt("/app/media");
    expect(await screen.findByTestId("media-workspace")).toBeInTheDocument();
  });

  it("shows unsupported/empty state without a selected project", async () => {
    renderAt("/app/media");
    expect(await screen.findByTestId("media-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No project selected");
    expect(screen.queryByTestId("import-bar")).not.toBeInTheDocument();
  });

  it("shows import bar when a project is selected", async () => {
    useAppStore.setState({
      currentProject: {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Demo",
        path: "/tmp/PVG/users/local/projects/Demo.pvg",
        workspaceId: "ws-local",
        schemaVersion: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        description: "",
      },
    });
    renderAt("/app/media");
    expect(await screen.findByTestId("import-bar")).toBeInTheDocument();
    expect(screen.getByTestId("import-drop-zone")).toBeInTheDocument();
    expect(screen.getByTestId("job-center")).toBeInTheDocument();
  });

  it("job center empty state", () => {
    render(
      <JobCenter jobs={[]} onCancel={() => undefined} />,
    );
    expect(screen.getByTestId("job-center")).toBeInTheDocument();
    expect(screen.getByTestId("empty-state")).toHaveTextContent("No media jobs");
  });

  it("mediaStore does not hold api keys", () => {
    const state = useMediaStore.getState();
    const serialized = JSON.stringify(state);
    expect(serialized.toLowerCase()).not.toMatch(/api[_-]?key/);
    expect(serialized.toLowerCase()).not.toMatch(/secret/);
    expect(serialized.toLowerCase()).not.toMatch(/bearer/);
    expect(serialized).not.toMatch(/sk-/);
    // Ensure store shape has no secret-looking fields
    const keys = Object.keys(state);
    expect(keys).not.toContain("apiKey");
    expect(keys).not.toContain("accessToken");
    expect(keys).not.toContain("refreshToken");
  });
});
