import { formatTimecode } from "@pvg/project-format";
import { useEditorStore } from "@/state/editorStore";

export function StatusBar() {
  const seq = useEditorStore((s) => s.getActiveSequence());
  const playback = useEditorStore((s) => s.playback);
  const dirty = useEditorStore((s) => s.dirty);
  const saving = useEditorStore((s) => s.saving);
  const selection = useEditorStore((s) => s.selection);
  const timelineUi = useEditorStore((s) => s.timelineUi);
  const lastError = useEditorStore((s) => s.lastError);

  if (!seq) return null;

  return (
    <footer className="editor-statusbar" data-testid="editor-statusbar">
      <span>{seq.frameRate} fps</span>
      <span className="mono">{formatTimecode(playback.currentTimeMs, seq.frameRate)}</span>
      <span>
        {seq.width}×{seq.height}
      </span>
      <span>Preview: {playback.previewMode}</span>
      <span>Snap {timelineUi.snapEnabled ? "ON" : "OFF"}</span>
      <span>
        Selection: {selection.clipIds.length || "none"}
      </span>
      <span className="grow" />
      {lastError ? <span className="err">{lastError}</span> : null}
      <span>{saving ? "Autosaving…" : dirty ? "Unsaved" : "Saved"}</span>
    </footer>
  );
}
