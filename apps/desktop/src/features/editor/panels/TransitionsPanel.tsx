import { useEditorStore } from "@/state/editorStore";
import {
  TRANSITION_LIBRARY,
  buildSetTransitionCommands,
  type TransitionLibraryItem,
} from "./libraryCatalog";

export function TransitionsPanel() {
  const seq = useEditorStore((s) => s.getActiveSequence());
  const selection = useEditorStore((s) => s.selection);
  const dispatch = useEditorStore((s) => s.dispatch);
  const clipIds = selection.clipIds;
  const canApply = Boolean(seq && clipIds.length > 0);

  const apply = (item: TransitionLibraryItem) => {
    if (!seq || item.status !== "ready" || !canApply) return;
    for (const cmd of buildSetTransitionCommands(seq.id, clipIds, item, "out")) {
      dispatch(cmd);
    }
  };

  return (
    <div className="ed-panel" data-testid="transitions-panel">
      <header className="ed-panel-h">Transitions</header>
      <div className="ed-panel-b">
        <p className="ed-hint">
          {canApply
            ? `Apply transition out on ${clipIds.length} selected clip${clipIds.length > 1 ? "s" : ""}. Cut clears in/out.`
            : "Select a clip on the timeline to apply transitions."}
        </p>
        <ul className="ed-lib-list dense">
          {TRANSITION_LIBRARY.map((item) => {
            const unavailable = item.status === "unavailable";
            const disabled = unavailable || !canApply;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`ed-lib-row ${unavailable ? "unavailable" : ""}`}
                  disabled={disabled}
                  title={
                    unavailable
                      ? "Not yet available"
                      : canApply
                        ? `Apply ${item.label}`
                        : "Select a clip first"
                  }
                  data-testid={`transition-${item.id}`}
                  data-status={item.status}
                  onClick={() => apply(item)}
                >
                  <span className="ed-lib-thumb" aria-hidden />
                  <span className="ed-lib-label">{item.label}</span>
                  {unavailable ? (
                    <span className="ed-lib-badge">Not yet available</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
