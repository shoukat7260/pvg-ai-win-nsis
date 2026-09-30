import { useEditorStore } from "@/state/editorStore";
import { InspectorPanel } from "../panels/InspectorPanel";
import { AiCopilotPanel } from "../panels/AiCopilotPanel";

/**
 * First-class right dock: Inspector | AI | Split.
 * Split mode: inspector top, AI bottom with pinned input — solves buried Copilot.
 */
export function RightDock() {
  const mode = useEditorStore((s) => s.rightDockMode);
  const setMode = useEditorStore((s) => s.setRightDockMode);
  const panels = useEditorStore((s) => s.panels);
  const patchPanels = useEditorStore((s) => s.patchPanels);

  return (
    <aside
      className="ed-right-dock"
      style={{ width: panels.rightWidth }}
      aria-label="Inspector and AI Copilot"
      data-testid="right-dock"
    >
      <div
        className="ed-resize-x left"
        onMouseDown={(e) =>
          startResizeX(e, panels.rightWidth, (w) => patchPanels({ rightWidth: w }), 260, 460, true)
        }
      />

      <div className="ed-dock-tabs" role="tablist" aria-label="Right panel mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "inspector"}
          className={mode === "inspector" ? "active" : ""}
          onClick={() => setMode("inspector")}
        >
          Inspector
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "split"}
          className={mode === "split" ? "active" : ""}
          onClick={() => setMode("split")}
          data-testid="dock-split"
        >
          Split
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "ai"}
          className={mode === "ai" ? "active" : ""}
          onClick={() => setMode("ai")}
          data-testid="dock-ai"
        >
          AI
        </button>
        <button
          type="button"
          className="ed-dock-collapse"
          title="Collapse right panel"
          aria-label="Collapse right panel"
          onClick={() => patchPanels({ rightCollapsed: true })}
        >
          ›
        </button>
      </div>

      <div className="ed-dock-body">
        {mode === "inspector" ? (
          <div className="ed-dock-pane fill">
            <InspectorPanel />
          </div>
        ) : null}
        {mode === "ai" ? (
          <div className="ed-dock-pane fill" data-testid="ai-dock-full">
            <p className="ed-hint" style={{ padding: "8px 12px 0", margin: 0 }}>
              Contextual assistant. Full PVG AI chatbot: Workspace → AI.
            </p>
            <AiCopilotPanel />
          </div>
        ) : null}
        {mode === "split" ? (
          <>
            <div
              className="ed-dock-pane"
              style={{ flexBasis: `${panels.inspectorSplitPct}%`, flexGrow: 0, flexShrink: 0 }}
            >
              <InspectorPanel />
            </div>
            <div
              className="ed-resize-y dock"
              onMouseDown={(e) => {
                e.preventDefault();
                const startY = e.clientY;
                const startPct = panels.inspectorSplitPct;
                const parent = (e.target as HTMLElement).parentElement;
                const onMove = (ev: MouseEvent) => {
                  const h = parent?.clientHeight || 400;
                  const delta = ((ev.clientY - startY) / h) * 100;
                  const next = Math.min(72, Math.max(28, startPct + delta));
                  patchPanels({ inspectorSplitPct: next });
                };
                const onUp = () => {
                  window.removeEventListener("mousemove", onMove);
                  window.removeEventListener("mouseup", onUp);
                };
                window.addEventListener("mousemove", onMove);
                window.addEventListener("mouseup", onUp);
              }}
              title="Drag to resize Inspector / AI"
            />
            <div className="ed-dock-pane grow" data-testid="ai-dock-split">
              <AiCopilotPanel />
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
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
