import { AppendClipCommand, createTextClip } from "@pvg/editor-core";
import { useEditorStore } from "@/state/editorStore";

/**
 * Captions left panel — only wire actions that editor-core already supports.
 * Auto / SRT import / dedicated caption styles are labeled unavailable for now.
 */
export function CaptionsPanel() {
  const seq = useEditorStore((s) => s.getActiveSequence());
  const dispatch = useEditorStore((s) => s.dispatch);
  const playhead = useEditorStore((s) => s.playback.currentTimeMs);

  const addManualCaption = () => {
    if (!seq) return;
    const track =
      seq.tracks.find((t) => t.type === "text" || t.type === "caption") ??
      seq.tracks[0];
    if (!track) return;
    dispatch(
      new AppendClipCommand(
        seq.id,
        track.id,
        createTextClip({ content: "Caption", startMs: playhead }),
      ),
    );
  };

  return (
    <div className="ed-panel" data-testid="captions-panel">
      <header className="ed-panel-h">Captions</header>
      <div className="ed-panel-b">
        <p className="ed-hint">
          Caption tools for the active sequence. Unavailable actions stay disabled until
          editor-core support lands.
        </p>
        <div className="ed-create-grid" style={{ gridTemplateColumns: "1fr" }}>
          <button type="button" className="ed-create-card" disabled title="Not yet available">
            Auto captions
            <span className="ed-muted" style={{ display: "block", fontSize: 11, marginTop: 4 }}>
              Not yet available
            </span>
          </button>
          <button
            type="button"
            className="ed-create-card"
            disabled={!seq}
            onClick={addManualCaption}
            data-testid="captions-manual"
          >
            Manual
            <span className="ed-muted" style={{ display: "block", fontSize: 11, marginTop: 4 }}>
              Add text caption at playhead
            </span>
          </button>
          <button type="button" className="ed-create-card" disabled title="Not yet available">
            Import SRT
            <span className="ed-muted" style={{ display: "block", fontSize: 11, marginTop: 4 }}>
              Not yet available
            </span>
          </button>
          <button type="button" className="ed-create-card" disabled title="Not yet available">
            Styles
            <span className="ed-muted" style={{ display: "block", fontSize: 11, marginTop: 4 }}>
              Not yet available
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
