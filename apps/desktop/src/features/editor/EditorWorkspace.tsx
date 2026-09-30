import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  SplitAtPlayheadCommand,
  DeleteClipsCommand,
  RippleDeleteCommand,
  DuplicateClipsCommand,
  RemoveMarkerCommand,
  createTextClip,
  createShapeClip,
  AppendClipCommand,
  AddMarkerCommand,
} from "@pvg/editor-core";
import { useAppStore } from "@/state/appStore";
import { useEditorStore } from "@/state/editorStore";
import { EditorTopBar } from "./EditorTopBar";
import { EditorRail } from "./EditorRail";
import { MediaPanel } from "./panels/MediaPanel";
import { ExportModal } from "./ExportModal";
import { OpenCutTimelinePanel } from "./panels/OpenCutTimelinePanel";
import { OpenCutEditorShell } from "./opencut/OpenCutEditorShell";
import { EditorDevOnlyBanner } from "./opencut/EditorDevOnlyBanner";
import { CanvasViewer } from "./panels/CanvasViewer";
import { HistoryPanel } from "./panels/HistoryPanel";
import { CaptionsPanel } from "./panels/CaptionsPanel";
import { EffectsPanel } from "./panels/EffectsPanel";
import { TransitionsPanel } from "./panels/TransitionsPanel";
import { ColorPanel } from "./panels/ColorPanel";
import { CommandPalette } from "./CommandPalette";
import { StatusBar } from "./StatusBar";
import { RightDock } from "./shell/RightDock";
import {
  classifyProjectLoadError,
  type ProjectLoadFailure,
} from "./projectLoadDiagnostics";
import { projectHasMissingMedia } from "./missingMedia";

export function EditorWorkspace() {
  const navigate = useNavigate();
  const project = useEditorStore((s) => s.project);
  const projectPath = useEditorStore((s) => s.projectPath);
  const openDocument = useEditorStore((s) => s.openDocument);
  const currentProject = useAppStore((s) => s.currentProject);
  const setProject = useAppStore((s) => s.setProject);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadFailure, setLoadFailure] = useState<ProjectLoadFailure | null>(null);
  const loadAttemptRef = useRef<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const runOpen = useCallback(
    async (path: string) => {
      setLoading(true);
      setLoadFailure(null);
      try {
        await openDocument(path);
      } catch (e) {
        const failure = classifyProjectLoadError(e);
        console.error("[ProjectLoadError]", failure.code, failure.stage, e);
        setLoadFailure(failure);
      } finally {
        setLoading(false);
      }
    },
    [openDocument],
  );

  useEffect(() => {
    const path = currentProject?.path;
    if (!path) {
      loadAttemptRef.current = null;
      return;
    }
    if (projectPath === path && project) return;
    const attemptKey = `${path}::${retryToken}`;
    if (loadAttemptRef.current === attemptKey) return;
    loadAttemptRef.current = attemptKey;
    void runOpen(path);
  }, [currentProject?.path, project, projectPath, retryToken, runOpen]);

  if (!currentProject) {
    return (
      <div className="ed-empty-screen" data-testid="editor-no-project">
        <h1>Start your project</h1>
        <p>Open or create a project from Home to enter the PVG AI editor.</p>
        <button
          type="button"
          className="pvg-btn pvg-btn--primary"
          style={{ marginTop: 16 }}
          onClick={() => navigate("/app/home")}
        >
          Go to Home
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="ed-empty-screen" data-testid="editor-loading">
        <p>Opening project…</p>
        <p style={{ fontSize: 12, opacity: 0.65, marginTop: 8 }}>
          Resolve → read → validate → migrate → media → editor
        </p>
      </div>
    );
  }

  if (loadFailure || !project) {
    const failure = loadFailure ?? {
      code: "unexpected" as const,
      stage: "mount_editor" as const,
      userMessage: "Unknown error",
      technicalMessage: "Project state missing after load",
    };
    return (
      <div className="ed-empty-screen" data-testid="editor-load-error">
        <h1>Could not open project</h1>
        <p>{failure.userMessage}</p>
        <p
          style={{ fontSize: 11, opacity: 0.55, marginTop: 8 }}
          data-testid="project-load-diag"
        >
          ProjectLoadError: stage={failure.stage} code={failure.code}
        </p>
        <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center" }}>
          <button
            type="button"
            className="pvg-btn pvg-btn--primary"
            data-testid="editor-load-retry"
            onClick={() => {
              loadAttemptRef.current = null;
              setRetryToken((n) => n + 1);
            }}
          >
            Retry
          </button>
          <button
            type="button"
            className="pvg-btn pvg-btn--ghost"
            onClick={() => {
              setProject(null);
              navigate("/app/home");
            }}
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <OpenCutEditorShell>
    <div className="ed-root" data-testid="editor-workspace">
      <EditorDevOnlyBanner />
      <EditorKeyboardLayer onOpenPalette={() => setPaletteOpen(true)} />
      <EditorTopBar
        onOpenPalette={() => setPaletteOpen(true)}
        onExport={() => setExportOpen(true)}
      />
      <MissingMediaBanner />
      <div className="ed-body">
        <EditorRail />
        <EditorMain />
      </div>
      <StatusBar />
      {paletteOpen ? (
        <CommandPalette onClose={() => setPaletteOpen(false)} />
      ) : null}
      {exportOpen ? <ExportModal onClose={() => setExportOpen(false)} /> : null}
    </div>
    </OpenCutEditorShell>
  );
}

/** Non-blocking: project already opened; prompt to relink via Media panel. */
function MissingMediaBanner() {
  const project = useEditorStore((s) => s.project);
  const setLeftPanel = useEditorStore((s) => s.setLeftPanel);
  const patchPanels = useEditorStore((s) => s.patchPanels);
  const [dismissed, setDismissed] = useState(false);

  const missing = projectHasMissingMedia(project);
  useEffect(() => {
    // Re-show when a newly opened project has missing media.
    setDismissed(false);
  }, [project?.id, project?.updatedAt]);

  if (!missing || dismissed) return null;

  return (
    <div className="ed-missing-media-banner" data-testid="missing-media-banner" role="status">
      <span className="ed-missing-media-title">Missing media</span>
      <span className="ed-missing-media-msg">
        Some assets have missing local paths. Relink to restore previews and export.
      </span>
      <button
        type="button"
        className="ed-btn primary"
        data-testid="missing-media-relink"
        onClick={() => {
          setLeftPanel("media");
          patchPanels({ leftCollapsed: false });
        }}
      >
        Relink
      </button>
      <button
        type="button"
        className="ed-btn ghost"
        aria-label="Dismiss missing media banner"
        onClick={() => setDismissed(true)}
      >
        Dismiss
      </button>
    </div>
  );
}

function EditorMain() {
  const leftPanel = useEditorStore((s) => s.leftPanel);
  const panels = useEditorStore((s) => s.panels);
  const patchPanels = useEditorStore((s) => s.patchPanels);
  const setRightDockMode = useEditorStore((s) => s.setRightDockMode);

  return (
    <div className="ed-main">
      {!panels.leftCollapsed ? (
        <aside
          className="ed-left"
          style={{ width: panels.leftWidth }}
          aria-label="Browser panel"
        >
          <div
            className="ed-resize-x"
            onMouseDown={(e) =>
              startResizeX(e, panels.leftWidth, (w) => patchPanels({ leftWidth: w }), 200, 400)
            }
          />
          {leftPanel === "media" || leftPanel === "project" ? <MediaPanel /> : null}
          {leftPanel === "history" ? <HistoryPanel /> : null}
          {leftPanel === "text" ? <TextShapesPanel /> : null}
          {leftPanel === "captions" ? <CaptionsPanel /> : null}
          {leftPanel === "transitions" ? <TransitionsPanel /> : null}
          {leftPanel === "effects" ? <EffectsPanel /> : null}
          {leftPanel === "color" ? <ColorPanel /> : null}
        </aside>
      ) : (
        <button
          type="button"
          className="ed-uncollapse-left"
          title="Show browser panel"
          aria-label="Show browser panel"
          onClick={() => patchPanels({ leftCollapsed: false })}
        >
          ‹
        </button>
      )}

      <div className="ed-center">
        <CanvasViewer />
        {!panels.timelineCollapsed ? (
          <div
            className="ed-timeline-wrap"
            style={{ height: panels.timelineHeight }}
          >
            <div
              className="ed-resize-y"
              onMouseDown={(e) =>
                startResizeY(e, panels.timelineHeight, (h) =>
                  patchPanels({ timelineHeight: h }),
                )
              }
            />
            <OpenCutTimelinePanel />
          </div>
        ) : null}
      </div>

      {!panels.rightCollapsed ? (
        <RightDock />
      ) : (
        <button
          type="button"
          className="ed-uncollapse-right"
          title="Show inspector / AI"
          aria-label="Show inspector and AI"
          onClick={() => {
            patchPanels({ rightCollapsed: false });
            setRightDockMode("inspector");
          }}
        >
          ›
        </button>
      )}
    </div>
  );
}

function TextShapesPanel() {
  const seq = useEditorStore((s) => s.getActiveSequence());
  const dispatch = useEditorStore((s) => s.dispatch);
  const playhead = useEditorStore((s) => s.playback.currentTimeMs);
  if (!seq) return null;
  return (
    <div className="ed-panel" data-testid="text-shapes-panel">
      <header className="ed-panel-h">Text & Shapes</header>
      <div className="ed-panel-b">
        <p className="ed-section-label">Text</p>
        <div className="ed-create-grid">
          <button
            type="button"
            className="ed-create-card"
            onClick={() => {
              const track =
                seq.tracks.find((t) => t.type === "text") ?? seq.tracks[0]!;
              dispatch(
                new AppendClipCommand(
                  seq.id,
                  track.id,
                  createTextClip({ content: "Title", startMs: playhead }),
                ),
              );
            }}
          >
            Title
          </button>
          <button
            type="button"
            className="ed-create-card"
            onClick={() => {
              const track =
                seq.tracks.find((t) => t.type === "text") ?? seq.tracks[0]!;
              dispatch(
                new AppendClipCommand(
                  seq.id,
                  track.id,
                  createTextClip({ content: "Subtitle", startMs: playhead }),
                ),
              );
            }}
          >
            Subtitle
          </button>
        </div>
        <p className="ed-section-label">Shapes</p>
        <div className="ed-create-grid">
          {(["rectangle", "circle", "line", "arrow"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              className="ed-create-card"
              onClick={() => {
                const track =
                  seq.tracks.find(
                    (t) => t.type === "overlay" || t.type === "graphics",
                  ) ?? seq.tracks[0]!;
                dispatch(
                  new AppendClipCommand(
                    seq.id,
                    track.id,
                    createShapeClip({ kind, startMs: playhead }),
                  ),
                );
              }}
            >
              {kind}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function EditorKeyboardLayer({ onOpenPalette }: { onOpenPalette: () => void }) {
  const selection = useEditorStore((s) => s.selection);
  const playback = useEditorStore((s) => s.playback);
  const timelineUi = useEditorStore((s) => s.timelineUi);
  const seq = useEditorStore((s) => s.getActiveSequence);
  const dispatch = useEditorStore((s) => s.dispatch);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const save = useEditorStore((s) => s.save);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const setTimelineUi = useEditorStore((s) => s.setTimelineUi);
  const copySelection = useEditorStore((s) => s.copySelection);
  const pasteAtPlayhead = useEditorStore((s) => s.pasteAtPlayhead);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;

      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenPalette();
        return;
      }
      if (mod && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }
      if (
        mod &&
        (e.key.toLowerCase() === "y" ||
          (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save();
        return;
      }
      if (mod && e.key.toLowerCase() === "c") {
        e.preventDefault();
        copySelection();
        return;
      }
      if (mod && e.key.toLowerCase() === "v") {
        e.preventDefault();
        pasteAtPlayhead();
        return;
      }
      if (mod && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const active = seq();
        if (active && selection.clipIds.length) {
          const primary = active.tracks
            .flatMap((t) => t.clips)
            .find((c) => c.id === selection.clipIds[0]);
          const dur =
            primary && primary.timelineEndMs != null
              ? primary.timelineEndMs - primary.timelineStartMs
              : 1000;
          dispatch(
            new DuplicateClipsCommand(active.id, selection.clipIds, dur),
          );
        }
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        setPlaying(!playback.playing);
        return;
      }
      if (e.key === "j") {
        setPlayhead(
          playback.currentTimeMs - (1000 / (seq()?.frameRate || 30)) * 5,
        );
        return;
      }
      if (e.key === "k") {
        setPlaying(false);
        return;
      }
      if (e.key === "l") {
        setPlayhead(
          playback.currentTimeMs + (1000 / (seq()?.frameRate || 30)) * 5,
        );
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setPlayhead(playback.currentTimeMs - 1000 / (seq()?.frameRate || 30));
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        setPlayhead(playback.currentTimeMs + 1000 / (seq()?.frameRate || 30));
        return;
      }
      if (e.key.toLowerCase() === "s" && !mod) {
        e.preventDefault();
        const active = seq();
        if (active && selection.clipIds.length) {
          dispatch(
            new SplitAtPlayheadCommand(
              active.id,
              selection.clipIds,
              playback.currentTimeMs,
            ),
          );
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const active = seq();
        if (!active) return;
        if (selection.clipIds.length) {
          dispatch(
            timelineUi.rippleMode === "ripple"
              ? new RippleDeleteCommand(active.id, selection.clipIds)
              : new DeleteClipsCommand(active.id, selection.clipIds),
          );
          return;
        }
        if (selection.markerIds?.length) {
          for (const id of selection.markerIds) {
            dispatch(new RemoveMarkerCommand(active.id, id));
          }
        }
        return;
      }
      if (e.key.toLowerCase() === "n" && !mod) {
        const active = seq();
        if (active) {
          dispatch(
            new AddMarkerCommand(active.id, {
              timeMs: playback.currentTimeMs,
              name: "Marker",
            }),
          );
        }
      }
      if (e.key.toLowerCase() === "m" && !mod) {
        setTimelineUi({ snapEnabled: !timelineUi.snapEnabled });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    copySelection,
    dispatch,
    onOpenPalette,
    pasteAtPlayhead,
    playback,
    redo,
    save,
    selection.clipIds,
    selection.markerIds,
    seq,
    setPlayhead,
    setPlaying,
    setTimelineUi,
    timelineUi.rippleMode,
    timelineUi.snapEnabled,
    undo,
  ]);

  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (!playback.playing) {
      if (raf.current) cancelAnimationFrame(raf.current);
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const active = seq();
      const next = playback.currentTimeMs + dt * playback.rate;
      const dur = active?.durationMs ?? 0;
      if (
        playback.loop &&
        playback.inPointMs != null &&
        playback.outPointMs != null
      ) {
        if (next >= playback.outPointMs) setPlayhead(playback.inPointMs);
        else setPlayhead(next);
      } else if (next >= dur && dur > 0) {
        setPlaying(false);
        setPlayhead(dur);
      } else {
        setPlayhead(next);
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [playback, seq, setPlayhead, setPlaying]);

  return null;
}

function startResizeX(
  e: React.MouseEvent,
  startW: number,
  setW: (w: number) => void,
  min: number,
  max: number,
  fromRight = false,
) {
  e.preventDefault();
  const startX = e.clientX;
  const onMove = (ev: MouseEvent) => {
    const dx = ev.clientX - startX;
    const next = fromRight ? startW - dx : startW + dx;
    setW(Math.min(max, Math.max(min, next)));
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}

function startResizeY(
  e: React.MouseEvent,
  startH: number,
  setH: (h: number) => void,
) {
  e.preventDefault();
  const startY = e.clientY;
  const onMove = (ev: MouseEvent) => {
    const dy = startY - ev.clientY;
    setH(Math.min(520, Math.max(140, startH + dy)));
  };
  const onUp = () => {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  };
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
}
