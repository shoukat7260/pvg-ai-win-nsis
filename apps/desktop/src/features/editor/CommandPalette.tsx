import { useEffect, useMemo, useState } from "react";
import {
  SplitAtPlayheadCommand,
  DeleteClipsCommand,
  RippleDeleteCommand,
  AddMarkerCommand,
  DuplicateClipsCommand,
} from "@pvg/editor-core";
import { useEditorStore } from "@/state/editorStore";

interface CommandDef {
  id: string;
  name: string;
  category: string;
  shortcut?: string;
  run: () => void;
}

export function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState("");
  const seq = useEditorStore((s) => s.getActiveSequence());
  const selection = useEditorStore((s) => s.selection);
  const playback = useEditorStore((s) => s.playback);
  const dispatch = useEditorStore((s) => s.dispatch);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const save = useEditorStore((s) => s.save);
  const setTimelineUi = useEditorStore((s) => s.setTimelineUi);
  const timelineUi = useEditorStore((s) => s.timelineUi);
  const patchPanels = useEditorStore((s) => s.patchPanels);
  const setRightDockMode = useEditorStore((s) => s.setRightDockMode);
  const setLeftPanel = useEditorStore((s) => s.setLeftPanel);

  const commands = useMemo<CommandDef[]>(() => {
    if (!seq) return [];
    return [
      {
        id: "split",
        name: "Split Clip",
        category: "Edit",
        shortcut: "S",
        run: () =>
          dispatch(
            new SplitAtPlayheadCommand(
              seq.id,
              selection.clipIds,
              playback.currentTimeMs,
            ),
          ),
      },
      {
        id: "delete",
        name: "Delete",
        category: "Edit",
        shortcut: "Delete",
        run: () =>
          dispatch(new DeleteClipsCommand(seq.id, selection.clipIds)),
      },
      {
        id: "ripple-delete",
        name: "Ripple Delete",
        category: "Edit",
        run: () =>
          dispatch(new RippleDeleteCommand(seq.id, selection.clipIds)),
      },
      {
        id: "duplicate",
        name: "Duplicate",
        category: "Edit",
        shortcut: "Ctrl+D",
        run: () => {
          if (!selection.clipIds.length) return;
          const primary = seq.tracks
            .flatMap((t) => t.clips)
            .find((c) => c.id === selection.clipIds[0]);
          const dur =
            primary && primary.timelineEndMs != null
              ? primary.timelineEndMs - primary.timelineStartMs
              : 1000;
          dispatch(
            new DuplicateClipsCommand(seq.id, selection.clipIds, dur),
          );
        },
      },
      {
        id: "marker",
        name: "Add Marker",
        category: "Timeline",
        shortcut: "N",
        run: () =>
          dispatch(
            new AddMarkerCommand(seq.id, {
              timeMs: playback.currentTimeMs,
              name: "Marker",
            }),
          ),
      },
      {
        id: "snap",
        name: "Toggle Snap",
        category: "Timeline",
        shortcut: "M",
        run: () => setTimelineUi({ snapEnabled: !timelineUi.snapEnabled }),
      },
      {
        id: "undo",
        name: "Undo",
        category: "Edit",
        shortcut: "Ctrl+Z",
        run: () => undo(),
      },
      {
        id: "redo",
        name: "Redo",
        category: "Edit",
        shortcut: "Ctrl+Shift+Z",
        run: () => redo(),
      },
      {
        id: "save",
        name: "Save Project",
        category: "File",
        shortcut: "Ctrl+S",
        run: () => void save(),
      },
      {
        id: "media",
        name: "Open Media",
        category: "View",
        run: () => {
          setLeftPanel("media");
          patchPanels({ leftCollapsed: false });
        },
      },
      {
        id: "ai",
        name: "Open AI Copilot",
        category: "AI",
        run: () => {
          patchPanels({ rightCollapsed: false });
          setRightDockMode("ai");
        },
      },
      {
        id: "inspector",
        name: "Show Inspector",
        category: "View",
        run: () => {
          patchPanels({ rightCollapsed: false });
          setRightDockMode("inspector");
        },
      },
      {
        id: "split-dock",
        name: "Split Inspector / AI",
        category: "View",
        run: () => {
          patchPanels({ rightCollapsed: false });
          setRightDockMode("split");
        },
      },
      {
        id: "reset-layout",
        name: "Reset Workspace Layout",
        category: "Window",
        run: () => useEditorStore.getState().resetWorkspaceLayout(),
      },
      {
        id: "zoom-in",
        name: "Zoom Timeline In",
        category: "Timeline",
        run: () =>
          setTimelineUi({ zoom: Math.min(4, timelineUi.zoom * 1.25) }),
      },
      {
        id: "zoom-out",
        name: "Zoom Timeline Out",
        category: "Timeline",
        run: () =>
          setTimelineUi({ zoom: Math.max(0.25, timelineUi.zoom / 1.25) }),
      },
    ];
  }, [
    dispatch,
    patchPanels,
    playback.currentTimeMs,
    redo,
    save,
    selection.clipIds,
    seq,
    setLeftPanel,
    setRightDockMode,
    setTimelineUi,
    timelineUi.snapEnabled,
    timelineUi.zoom,
    undo,
  ]);

  const filtered = commands.filter((c) => {
    const hay = `${c.name} ${c.category} ${c.shortcut ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="cmd-palette-backdrop" onClick={onClose} data-testid="command-palette">
      <div
        className="cmd-palette"
        role="dialog"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search actions…"
          aria-label="Search commands"
        />
        <ul>
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => {
                  c.run();
                  onClose();
                }}
              >
                <span>
                  <strong>{c.name}</strong>
                  <small>{c.category}</small>
                </span>
                {c.shortcut ? <kbd>{c.shortcut}</kbd> : null}
              </button>
            </li>
          ))}
          {filtered.length === 0 ? (
            <li className="ed-muted">No matching commands</li>
          ) : null}
        </ul>
      </div>
    </div>
  );
}
