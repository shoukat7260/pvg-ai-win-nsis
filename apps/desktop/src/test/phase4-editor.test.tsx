import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
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

describe("Phase 4 editor workspace", () => {
  beforeEach(() => {
    useEditorStore.getState().closeDocument();
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

  it("renders professional editor chrome after loading project", async () => {
    render(wrap(<EditorWorkspace />));
    await waitFor(() => {
      expect(screen.getByTestId("editor-workspace")).toBeInTheDocument();
    });
    expect(screen.getByTestId("editor-topbar")).toBeInTheDocument();
    expect(screen.getByTestId("editor-rail")).toBeInTheDocument();
    expect(screen.getByTestId("canvas-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("opencut-timeline-panel")).toBeInTheDocument();
    expect(screen.getByTestId("ai-copilot-panel")).toBeInTheDocument();
    expect(screen.getByTestId("inspector-panel")).toBeInTheDocument();
  });

  it("shows empty state when no project selected", () => {
    useAppStore.setState({ currentProject: null });
    render(wrap(<EditorWorkspace />));
    expect(screen.getByTestId("editor-no-project")).toBeInTheDocument();
  });
});
