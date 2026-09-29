import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, beforeEach } from "vitest";
import { AppRouter } from "@/app/router";
import { useAuthStore } from "@/auth/authStore";
import { useAppStore } from "@/state/appStore";

describe("settings", () => {
  beforeEach(() => {
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
  });

  it("toggles foundation settings", async () => {
    const user = userEvent.setup();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={["/app/settings/preferences"]}>
          <AppRouter />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByTestId("settings-shell")).toBeInTheDocument();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes[0]).toBeChecked();
    await user.click(boxes[1]!);
    expect(useAppStore.getState().appSettings.reduceMotion).toBe(true);
  });
});
