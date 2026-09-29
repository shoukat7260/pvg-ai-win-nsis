import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { EditorWorkspace } from "@/features/editor";
import { useAppStore } from "@/state/appStore";
import { useEditorStore } from "@/state/editorStore";
import "@/features/editor/editor.css";

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/app/edit"]}>
        <Routes>
          <Route path="/app/edit" element={ui} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Phase 4.1 workspace layout", () => {
  beforeEach(() => {
    useEditorStore.getState().closeDocument();
    useEditorStore.getState().resetWorkspaceLayout();
    useAppStore.setState({
      currentProject: {
        id: "550e8400-e29b-41d4-a716-446655440099",
        name: "Editor Test",
        path: "/tmp/PVG/users/local/projects/Editor-Test.pvg",
        workspaceId: "ws-local",
        schemaVersion: 3,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        description: "",
      },
    });
  });

  it("exposes first-class right dock with Inspector / AI / Split", async () => {
    render(wrap(<EditorWorkspace />));
    await waitFor(() => {
      expect(screen.getByTestId("right-dock")).toBeInTheDocument();
    });
    expect(screen.getByRole("tab", { name: "Inspector" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "AI Copilot" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Split" })).toBeInTheDocument();
    expect(screen.getByTestId("ai-copilot-panel")).toBeInTheDocument();
    expect(screen.getByTestId("inspector-panel")).toBeInTheDocument();
  });

  it("switches right dock to AI-only mode", async () => {
    render(wrap(<EditorWorkspace />));
    await waitFor(() => screen.getByTestId("right-dock"));
    fireEvent.click(screen.getByRole("tab", { name: "AI Copilot" }));
    expect(useEditorStore.getState().rightDockMode).toBe("ai");
    expect(screen.getByTestId("ai-copilot-panel")).toBeInTheDocument();
  });

  it("rail uses labeled icon tools not letter placeholders", async () => {
    render(wrap(<EditorWorkspace />));
    await waitFor(() => screen.getByTestId("editor-rail"));
    const rail = screen.getByTestId("editor-rail");
    expect(rail.querySelector('[aria-label="Media"]')).toBeTruthy();
    expect(rail.querySelector('[aria-label="History"]')).toBeTruthy();
    expect(rail.querySelector('[aria-label="Text & Shapes"]')).toBeTruthy();
    expect(rail.textContent).not.toMatch(/^\s*M\s*$/m);
  });

  it("persists layout prefs key and reset restores defaults", () => {
    useEditorStore.getState().patchPanels({ rightWidth: 400, timelineHeight: 320 });
    expect(localStorage.getItem("pvg-editor-layout-v41")).toBeTruthy();
    useEditorStore.getState().resetWorkspaceLayout();
    const p = useEditorStore.getState().panels;
    expect(p.rightWidth).toBe(340);
    expect(p.timelineHeight).toBe(240);
    expect(useEditorStore.getState().rightDockMode).toBe("split");
  });
});
