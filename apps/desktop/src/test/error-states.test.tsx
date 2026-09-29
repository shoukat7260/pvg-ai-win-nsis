import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { AppRouter } from "@/app/router";
import { useAuthStore } from "@/auth/authStore";
import { useAppStore } from "@/state/appStore";
import * as tauri from "@/services/tauri";

describe("error states", () => {
  beforeEach(() => {
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
    useAppStore.setState({
      currentWorkspace: {
        id: "ws-local",
        displayName: "Local Test Workspace",
        projectsRoot: "/tmp/PVG/users/local/projects",
        dataRoot: "/tmp/PVG",
      },
      currentProject: null,
    });
  });

  it(
    "surfaces invalid project name errors",
    async () => {
      const user = userEvent.setup();
      const client = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });

      vi.spyOn(tauri.nativeApi, "listWorkspaceProjects").mockResolvedValue({
        workspaceRoot: "/tmp/PVG/users/local/projects",
        projects: [],
      });

      render(
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={["/app/home"]}>
            <AppRouter />
          </MemoryRouter>
        </QueryClientProvider>,
      );

      const input = await screen.findByTestId("project-name-input");
      await user.clear(input);
      await user.click(input);
      await user.paste("../escape");
      await user.click(screen.getByTestId("create-project"));

      await waitFor(() => {
        expect(screen.getByTestId("error-state")).toBeInTheDocument();
      });
      expect(screen.getByTestId("error-state")).toHaveTextContent(/path characters/i);
    },
    10_000,
  );
});
