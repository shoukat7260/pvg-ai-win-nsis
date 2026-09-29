import { create } from "zustand";
import {
  loadProject,
  type ProjectDocument,
  type Sequence,
} from "@pvg/project-format";
import {
  HistoryStack,
  type EditorCommand,
  type EditorSelection,
  type PlaybackState,
  type TimelineUiState,
  type EditMode,
  type InsertMode,
  type AiPlan,
  EMPTY_SELECTION,
  defaultPlayback,
  defaultTimelineUi,
  ensureEditorTracks,
  activeSequence,
  serializeClipboard,
  pasteClipboard,
  type EditorClipboardPayload,
  AppendClipCommand,
  createMediaClip,
} from "@pvg/editor-core";
import { migrateProjectForOpenCutEditor } from "@pvg/opencut-integration";
import { nativeApi } from "@/services/tauri";

const LAYOUT_KEY = "pvg-editor-layout-v41";

export type EditorLayoutPanels = {
  leftWidth: number;
  rightWidth: number;
  timelineHeight: number;
  /** 0–100: inspector share when split (AI gets remainder). */
  inspectorSplitPct: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
  timelineCollapsed: boolean;
  railExpanded: boolean;
};

function defaultPanels(): EditorLayoutPanels {
  return {
    leftWidth: 260,
    rightWidth: 340,
    timelineHeight: 240,
    inspectorSplitPct: 48,
    leftCollapsed: false,
    rightCollapsed: false,
    timelineCollapsed: false,
    railExpanded: false,
  };
}

function loadLayoutPrefs(): EditorLayoutPanels {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (!raw) return defaultPanels();
    return { ...defaultPanels(), ...JSON.parse(raw) };
  } catch {
    return defaultPanels();
  }
}

function persistLayoutPrefs(panels: EditorLayoutPanels): EditorLayoutPanels {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(panels));
  } catch {
    /* ignore quota */
  }
  return panels;
}

interface EditorState {
  projectPath: string | null;
  project: ProjectDocument | null;
  activeSequenceId: string | null;
  selection: EditorSelection;
  playback: PlaybackState;
  timelineUi: TimelineUiState;
  dirty: boolean;
  tool: EditMode;
  insertMode: InsertMode;
  saving: boolean;
  lastError: string | null;
  leftPanel: "media" | "project" | "text" | "transitions" | "effects" | "history";
  /** Right dock: inspector-only, ai-only, or split (inspector top / AI bottom). */
  rightDockMode: "inspector" | "ai" | "split";
  panels: EditorLayoutPanels;
  workspacePreset: "editor" | "media" | "audio" | "color" | "ai";
  clipboard: EditorClipboardPayload | null;
  pendingAiPlan: AiPlan | null;
  aiMessages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    plan?: AiPlan;
  }>;
  historyLabels: string[];
  openDocument: (path: string) => Promise<void>;
  closeDocument: () => void;
  dispatch: (command: EditorCommand) => void;
  undo: () => void;
  redo: () => void;
  save: () => Promise<void>;
  setSelection: (sel: Partial<EditorSelection>) => void;
  setPlayhead: (ms: number) => void;
  setPlaying: (playing: boolean) => void;
  setTool: (tool: EditMode) => void;
  setTimelineUi: (patch: Partial<TimelineUiState>) => void;
  setLeftPanel: (panel: EditorState["leftPanel"]) => void;
  setRightDockMode: (mode: EditorState["rightDockMode"]) => void;
  patchPanels: (patch: Partial<EditorLayoutPanels>) => void;
  resetWorkspaceLayout: () => void;
  setWorkspacePreset: (preset: EditorState["workspacePreset"]) => void;
  setPendingAiPlan: (plan: AiPlan | null) => void;
  pushAiMessage: (msg: EditorState["aiMessages"][number]) => void;
  clearAiChat: () => void;
  getActiveSequence: () => Sequence | null;
  appendAssetToTimeline: (assetId: string, kind: string, durationMs: number, name: string) => void;
  copySelection: () => void;
  pasteAtPlayhead: () => void;
}

let history = new HistoryStack();
let autosaveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleAutosave(get: () => EditorState) {
  if (autosaveTimer) clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(() => {
    const s = get();
    if (s.dirty && s.project && s.projectPath) {
      void s.save();
    }
  }, 2500);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  projectPath: null,
  project: null,
  activeSequenceId: null,
  selection: { ...EMPTY_SELECTION },
  playback: defaultPlayback(),
  timelineUi: defaultTimelineUi(),
  dirty: false,
  tool: "select",
  insertMode: "append",
  saving: false,
  lastError: null,
  leftPanel: "media",
  rightDockMode: "split",
  panels: loadLayoutPrefs(),
  workspacePreset: "editor",
  clipboard: null,
  pendingAiPlan: null,
  aiMessages: [],
  historyLabels: [],

  openDocument: async (path: string) => {
    const raw = await nativeApi.loadProjectDocument(path);
    let doc = migrateProjectForOpenCutEditor(loadProject(raw));
    const seq = activeSequence(doc);
    const ensured = ensureEditorTracks(seq);
    if (ensured !== seq) {
      doc = {
        ...doc,
        sequences: doc.sequences.map((s) => (s.id === seq.id ? ensured : s)),
      };
    }
    history = new HistoryStack();
    set({
      projectPath: path,
      project: doc,
      activeSequenceId: ensured.id,
      selection: { ...EMPTY_SELECTION },
      playback: defaultPlayback(),
      dirty: false,
      lastError: null,
      pendingAiPlan: null,
      aiMessages: [
        {
          id: crypto.randomUUID(),
          role: "system",
          content:
            "PVG AI Copilot is ready. Ask for timeline edits — I’ll propose safe commands you can confirm.",
        },
      ],
      historyLabels: [],
    });
  },

  closeDocument: () => {
    history = new HistoryStack();
    set({
      projectPath: null,
      project: null,
      activeSequenceId: null,
      dirty: false,
      selection: { ...EMPTY_SELECTION },
      pendingAiPlan: null,
      aiMessages: [],
      historyLabels: [],
    });
  },

  dispatch: (command) => {
    const { project } = get();
    if (!project) return;
    try {
      const next = history.push(command, project);
      set({
        project: next,
        dirty: true,
        lastError: null,
        historyLabels: history.undoLabels,
      });
      scheduleAutosave(get);
    } catch (e) {
      set({
        lastError: e instanceof Error ? e.message : "Edit failed",
      });
    }
  },

  undo: () => {
    const { project } = get();
    if (!project || !history.canUndo) return;
    try {
      const next = history.undo(project);
      set({
        project: next,
        dirty: true,
        historyLabels: history.undoLabels,
      });
      scheduleAutosave(get);
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : "Undo failed" });
    }
  },

  redo: () => {
    const { project } = get();
    if (!project || !history.canRedo) return;
    try {
      const next = history.redo(project);
      set({
        project: next,
        dirty: true,
        historyLabels: history.undoLabels,
      });
      scheduleAutosave(get);
    } catch (e) {
      set({ lastError: e instanceof Error ? e.message : "Redo failed" });
    }
  },

  save: async () => {
    const { project, projectPath } = get();
    if (!project || !projectPath) return;
    set({ saving: true });
    try {
      const meta = await nativeApi.saveProject(projectPath, project);
      set({
        dirty: false,
        saving: false,
        project: {
          ...project,
          updatedAt: meta.updatedAt,
          lastSavedAt: meta.updatedAt,
        },
      });
    } catch (e) {
      set({
        saving: false,
        lastError: e instanceof Error ? e.message : "Save failed",
      });
    }
  },

  setSelection: (sel) =>
    set((s) => ({ selection: { ...s.selection, ...sel } })),

  setPlayhead: (ms) =>
    set((s) => ({
      playback: { ...s.playback, currentTimeMs: Math.max(0, ms) },
    })),

  setPlaying: (playing) =>
    set((s) => ({ playback: { ...s.playback, playing } })),

  setTool: (tool) => set({ tool }),

  setTimelineUi: (patch) =>
    set((s) => ({ timelineUi: { ...s.timelineUi, ...patch } })),

  setLeftPanel: (leftPanel) => set({ leftPanel }),

  setRightDockMode: (rightDockMode) => set({ rightDockMode }),

  patchPanels: (patch) =>
    set((s) => {
      const panels = { ...s.panels, ...patch };
      persistLayoutPrefs(panels);
      return { panels };
    }),

  resetWorkspaceLayout: () => {
    const panels = defaultPanels();
    persistLayoutPrefs(panels);
    set({
      panels,
      rightDockMode: "split",
      workspacePreset: "editor",
      leftPanel: "media",
    });
  },

  setWorkspacePreset: (workspacePreset) => {
    if (workspacePreset === "media") {
      set({
        workspacePreset,
        panels: persistLayoutPrefs({
          ...get().panels,
          leftCollapsed: false,
          rightCollapsed: true,
          timelineHeight: 180,
        }),
        leftPanel: "media",
      });
    } else if (workspacePreset === "ai") {
      set({
        workspacePreset,
        rightDockMode: "ai",
        panels: persistLayoutPrefs({
          ...get().panels,
          rightCollapsed: false,
          leftCollapsed: true,
          rightWidth: Math.max(get().panels.rightWidth, 360),
        }),
      });
    } else {
      const panels = defaultPanels();
      persistLayoutPrefs(panels);
      set({
        workspacePreset: "editor",
        panels,
        rightDockMode: "split",
      });
    }
  },

  setPendingAiPlan: (pendingAiPlan) => set({ pendingAiPlan }),

  pushAiMessage: (msg) =>
    set((s) => ({ aiMessages: [...s.aiMessages, msg] })),

  clearAiChat: () =>
    set({
      aiMessages: [],
      pendingAiPlan: null,
    }),

  getActiveSequence: () => {
    const { project, activeSequenceId } = get();
    if (!project) return null;
    return activeSequence(project, activeSequenceId);
  },

  appendAssetToTimeline: (assetId, kind, durationMs, name) => {
    const seq = get().getActiveSequence();
    if (!seq) return;
    const track =
      seq.tracks.find((t) =>
        kind === "audio"
          ? t.type === "audio"
          : t.type === "video" || t.type === "overlay",
      ) ?? seq.tracks[0];
    if (!track) return;
    const clip = createMediaClip({
      assetId,
      kind: kind === "audio" ? "audio" : kind === "image" ? "image" : "video",
      durationMs: Math.max(100, durationMs),
      label: name,
    });
    get().dispatch(new AppendClipCommand(seq.id, track.id, clip));
    get().setSelection({ clipIds: [clip.id], trackIds: [track.id] });
  },

  copySelection: () => {
    const seq = get().getActiveSequence();
    if (!seq) return;
    const clips = seq.tracks
      .flatMap((t) => t.clips)
      .filter((c) => get().selection.clipIds.includes(c.id));
    if (!clips.length) return;
    set({ clipboard: serializeClipboard(clips) });
  },

  pasteAtPlayhead: () => {
    const { clipboard, playback } = get();
    const seq = get().getActiveSequence();
    if (!clipboard || !seq) return;
    const clips = pasteClipboard(clipboard, playback.currentTimeMs);
    for (const clip of clips) {
      const track =
        seq.tracks.find((t) =>
          clip.kind === "audio"
            ? t.type === "audio"
            : clip.kind === "text"
              ? t.type === "text"
              : t.type === "video",
        ) ?? seq.tracks[0];
      if (track) {
        get().dispatch(new AppendClipCommand(seq.id, track.id, clip));
      }
    }
  },
}));
