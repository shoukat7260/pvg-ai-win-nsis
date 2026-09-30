import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AddEffectCommand,
  AppendClipCommand,
  EMPTY_SELECTION,
  SetTransitionCommand,
  activeSequence,
  createMediaClip,
  ensureEditorTracks,
} from "@pvg/editor-core";
import { loadProject, type ProjectAsset, type ProjectDocument } from "@pvg/project-format";
import { EditorWorkspace } from "@/features/editor";
import { useAppStore } from "@/state/appStore";
import { useEditorStore } from "@/state/editorStore";
import {
  assetsWithMissingLocalPaths,
  projectHasMissingMedia,
} from "@/features/editor/missingMedia";
import {
  COLOR_LIBRARY,
  EFFECT_LIBRARY,
  TRANSITION_LIBRARY,
  buildAddEffectCommands,
  buildSetTransitionCommands,
} from "@/features/editor/panels/libraryCatalog";
import { EffectsPanel } from "@/features/editor/panels/EffectsPanel";
import { TransitionsPanel } from "@/features/editor/panels/TransitionsPanel";
import { ColorPanel } from "@/features/editor/panels/ColorPanel";
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

function asset(partial: Partial<ProjectAsset> & Pick<ProjectAsset, "id" | "name">): ProjectAsset {
  return {
    kind: "video",
    relativePath: `media/${partial.name}`,
    mimeType: null,
    byteSize: null,
    sourceAssetId: null,
    availability: "available",
    fingerprint: null,
    video: null,
    audio: null,
    image: null,
    thumbnail: null,
    waveform: null,
    proxy: null,
    binId: null,
    favorite: false,
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...partial,
  };
}

function minimalDoc(assets: ProjectAsset[] = []): ProjectDocument {
  return loadProject({
    id: "550e8400-e29b-41d4-a716-446655440000",
    name: "Lib Test",
    schemaVersion: 3,
    workspaceId: "ws-local",
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    lastSavedAt: null,
    appVersion: null,
    lastRecoveredAt: null,
    assets,
    bins: [],
    sequences: [
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "Seq",
        width: 1920,
        height: 1080,
        frameRate: 30,
        sampleRate: 48000,
        durationMs: 5000,
        tracks: [
          {
            id: "550e8400-e29b-41d4-a716-446655440002",
            type: "video",
            name: "V1",
            enabled: true,
            locked: false,
            muted: false,
            solo: false,
            visible: true,
            height: 48,
            clips: [],
          },
        ],
        markers: [],
      },
    ],
    settings: {},
  });
}

function seedEditorWithClip() {
  const doc = minimalDoc();
  const seq = ensureEditorTracks(activeSequence(doc));
  useEditorStore.setState({
    project: { ...doc, sequences: doc.sequences.map((s) => (s.id === seq.id ? seq : s)) },
    activeSequenceId: seq.id,
    selection: { ...EMPTY_SELECTION },
    dirty: false,
  });
  const clip = createMediaClip({
    assetId: "550e8400-e29b-41d4-a716-446655440099",
    kind: "video",
    startMs: 0,
    durationMs: 2000,
    label: "Clip",
  });
  const track = seq.tracks.find((t) => t.type === "video") ?? seq.tracks[0]!;
  useEditorStore.getState().dispatch(new AppendClipCommand(seq.id, track.id, clip));
  const clipId = useEditorStore.getState().getActiveSequence()!.tracks.flatMap((t) => t.clips)[0]!
    .id;
  useEditorStore.getState().setSelection({ clipIds: [clipId] });
  return clipId;
}

describe("Phase 4.3 library mutations + missing media", () => {
  beforeEach(() => {
    useEditorStore.getState().closeDocument();
  });

  it("catalogs label unavailable items and build real commands for ready ones", () => {
    expect(EFFECT_LIBRARY.some((i) => i.status === "unavailable")).toBe(true);
    expect(TRANSITION_LIBRARY.some((i) => i.status === "unavailable")).toBe(true);
    expect(COLOR_LIBRARY.some((i) => i.status === "unavailable")).toBe(true);

    const fx = EFFECT_LIBRARY.find((i) => i.id === "blur")!;
    const cmds = buildAddEffectCommands("seq", ["clip-a"], fx);
    expect(cmds).toHaveLength(1);
    expect(cmds[0]).toBeInstanceOf(AddEffectCommand);

    const cut = TRANSITION_LIBRARY.find((i) => i.id === "cut")!;
    const cutCmds = buildSetTransitionCommands("seq", ["clip-a"], cut);
    expect(cutCmds.every((c) => c instanceof SetTransitionCommand)).toBe(true);

    const glow = EFFECT_LIBRARY.find((i) => i.id === "glow")!;
    expect(buildAddEffectCommands("seq", ["clip-a"], glow)).toHaveLength(0);
  });

  it("detects missing local paths without blocking open", () => {
    const missing = assetsWithMissingLocalPaths([
      asset({
        id: "550e8400-e29b-41d4-a716-446655440010",
        name: "gone.mp4",
        location: { mode: "link", absolutePath: "" },
      }),
      asset({
        id: "550e8400-e29b-41d4-a716-446655440011",
        name: "ok.png",
        kind: "image",
        location: { mode: "copy", relativePath: "media/ok.png" },
      }),
    ]);
    expect(missing).toHaveLength(1);
    expect(missing[0]!.name).toBe("gone.mp4");

    const doc = minimalDoc([
      asset({
        id: "550e8400-e29b-41d4-a716-446655440012",
        name: "offline.mp4",
        location: { mode: "link", absolutePath: "/old/path.mp4" },
        availability: "missing",
      }),
    ]);
    expect(projectHasMissingMedia(doc)).toBe(true);
    expect(projectHasMissingMedia(minimalDoc([]))).toBe(false);
  });

  it("EffectsPanel dispatches AddEffectCommand when clip selected", () => {
    seedEditorWithClip();
    render(wrap(<EffectsPanel />));
    fireEvent.click(screen.getByTestId("effect-blur"));
    const applied = useEditorStore.getState().getActiveSequence()!;
    expect(applied.tracks.flatMap((t) => t.clips)[0]!.effects.some((e) => e.type === "blur")).toBe(
      true,
    );
    expect(screen.getByTestId("effect-glow")).toBeDisabled();
    expect(screen.getByTestId("effect-glow").textContent).toMatch(/Not yet available/);
  });

  it("TransitionsPanel and ColorPanel wire ready items; unavailable stay labeled", () => {
    seedEditorWithClip();
    const { rerender } = render(wrap(<TransitionsPanel />));
    fireEvent.click(screen.getByTestId("transition-dissolve"));
    expect(
      useEditorStore.getState().getActiveSequence()!.tracks.flatMap((t) => t.clips)[0]!
        .transitionOut?.type,
    ).toBe("dissolve");
    expect(screen.getByTestId("transition-zoom")).toBeDisabled();

    rerender(wrap(<ColorPanel />));
    fireEvent.click(screen.getByTestId("color-temperature"));
    expect(
      useEditorStore
        .getState()
        .getActiveSequence()!
        .tracks.flatMap((t) => t.clips)[0]!
        .effects.some((e) => e.type === "temperature"),
    ).toBe(true);
    expect(screen.getByTestId("color-lut").textContent).toMatch(/Not yet available/);
  });

  it("shows Missing media banner after open when assets lack local paths", async () => {
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

    const doc = minimalDoc([
      asset({
        id: "550e8400-e29b-41d4-a716-446655440020",
        name: "lost.mp4",
        location: { mode: "link", absolutePath: "   " },
      }),
    ]);
    useEditorStore.setState({
      projectPath: "/tmp/PVG/users/local/projects/Editor-Test.pvg",
      project: doc,
      activeSequenceId: doc.sequences[0]!.id,
    });

    render(wrap(<EditorWorkspace />));
    await waitFor(() => {
      expect(screen.getByTestId("editor-workspace")).toBeInTheDocument();
    });
    expect(screen.getByTestId("missing-media-banner")).toBeInTheDocument();
    expect(screen.getByText("Missing media")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("missing-media-relink"));
    expect(useEditorStore.getState().leftPanel).toBe("media");
  });
});
