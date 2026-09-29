import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, beforeEach, vi } from "vitest";
import { AppRouter } from "@/app/router";
import { useAuthStore } from "@/auth/authStore";
import { useAppStore } from "@/state/appStore";

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

describe("navigation", () => {
  beforeEach(() => {
    useAuthStore.setState({ status: "AUTHENTICATED", user: authedUser });
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

  it("navigates between foundation shells", async () => {
    const user = userEvent.setup();
    renderApp("/app/home");

    await user.click(screen.getByRole("link", { name: "Settings" }));
    expect(await screen.findByTestId("settings-account")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "Security" }));
    expect(await screen.findByTestId("settings-security")).toBeInTheDocument();

    await user.click(screen.getByRole("link", { name: "About" }));
    expect(await screen.findByTestId("about-diagnostics")).toBeInTheDocument();
  });

  it("keeps future nav items disabled", () => {
    renderApp("/app/home");
    const ai = screen.getByTestId("nav-disabled-ai");
    expect(ai).toBeDisabled();
    expect(ai).toHaveAttribute("title", "Coming later");
    expect(screen.getByTestId("nav-disabled-create")).toBeDisabled();
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
    expect(screen.queryByTestId("nav-disabled-edit")).not.toBeInTheDocument();
    expect(screen.queryByTestId("nav-disabled-media")).not.toBeInTheDocument();
  });

  it("enables Media in primary nav", async () => {
    const user = userEvent.setup();
    renderApp("/app/home");
    await user.click(screen.getByRole("link", { name: "Media" }));
    expect(await screen.findByTestId("media-workspace")).toBeInTheDocument();
  });
});
