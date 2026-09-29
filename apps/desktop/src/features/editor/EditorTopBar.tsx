import { formatTimecode } from "@pvg/project-format";
import { useEditorStore } from "@/state/editorStore";
import {
  IconCommand,
  IconRedo,
  IconSave,
  IconUndo,
} from "./icons/EditorIcons";

export function EditorTopBar({
  onOpenPalette,
  onExport,
}: {
  onOpenPalette: () => void;
  onExport?: () => void;
}) {
  const project = useEditorStore((s) => s.project);
  const seq = useEditorStore((s) => s.getActiveSequence());
  const dirty = useEditorStore((s) => s.dirty);
  const saving = useEditorStore((s) => s.saving);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const save = useEditorStore((s) => s.save);
  const setWorkspacePreset = useEditorStore((s) => s.setWorkspacePreset);
  const workspacePreset = useEditorStore((s) => s.workspacePreset);
  const resetWorkspaceLayout = useEditorStore((s) => s.resetWorkspaceLayout);
  const playback = useEditorStore((s) => s.playback);

  if (!project || !seq) return null;

  return (
    <header className="ed-topbar" data-testid="editor-topbar">
      <div className="ed-topbar-left">
        <span className="ed-brand" aria-label="PVG AI">
          PVG AI
        </span>
        <nav className="ed-breadcrumb" data-testid="project-header" aria-label="Project">
          <span className="ed-crumb strong">{project.name}</span>
          <span className="ed-crumb-sep">/</span>
          <span className="ed-crumb">{seq.name}</span>
          <span className="ed-meta">
            {seq.width}×{seq.height} · {seq.frameRate} fps
          </span>
          <span
            className={`ed-save-pill ${dirty ? "dirty" : "clean"}`}
            data-testid="save-state"
          >
            {saving ? "Saving…" : dirty ? "Unsaved" : "Saved"}
          </span>
        </nav>
      </div>

      <div
        className="ed-workspace-switch"
        role="tablist"
        aria-label="Workspace"
      >
        {(["editor", "media", "ai"] as const).map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={workspacePreset === p}
            className={workspacePreset === p ? "active" : ""}
            onClick={() => setWorkspacePreset(p)}
          >
            {p}
          </button>
        ))}
        <button type="button" disabled title="Coming later — Phase 6/7">
          audio
        </button>
        <button type="button" disabled title="Coming later — Phase 7">
          color
        </button>
      </div>

      <div className="ed-topbar-right">
        <span className="ed-meta mono">
          {formatTimecode(playback.currentTimeMs, seq.frameRate)}
        </span>
        <button
          type="button"
          className="ed-icon-btn"
          onClick={() => undo()}
          title="Undo (Ctrl+Z)"
          aria-label="Undo"
        >
          <IconUndo />
        </button>
        <button
          type="button"
          className="ed-icon-btn"
          onClick={() => redo()}
          title="Redo (Ctrl+Shift+Z)"
          aria-label="Redo"
        >
          <IconRedo />
        </button>
        <button
          type="button"
          className="ed-icon-btn"
          onClick={onOpenPalette}
          title="Command palette (Ctrl+K)"
          aria-label="Command palette"
        >
          <IconCommand />
        </button>
        <button
          type="button"
          className="ed-btn ghost"
          title="Reset workspace layout"
          onClick={() => {
            if (window.confirm("Reset workspace to PVG Editor defaults?")) {
              resetWorkspaceLayout();
            }
          }}
        >
          Reset layout
        </button>
        <button
          type="button"
          className="ed-btn primary"
          onClick={() => void save()}
          data-testid="editor-save"
          title="Save (Ctrl+S)"
        >
          <IconSave />
          Save
        </button>
        <button
          type="button"
          className="ed-btn"
          onClick={() => onExport?.()}
          data-testid="editor-export"
          title="Export sequence to MP4"
        >
          Export
        </button>
      </div>
    </header>
  );
}
