import { useEditorStore } from "@/state/editorStore";
import {
  EFFECT_LIBRARY,
  buildAddEffectCommands,
  type EffectLibraryItem,
} from "./libraryCatalog";

export function EffectsPanel() {
  const seq = useEditorStore((s) => s.getActiveSequence());
  const selection = useEditorStore((s) => s.selection);
  const dispatch = useEditorStore((s) => s.dispatch);
  const clipIds = selection.clipIds;
  const canApply = Boolean(seq && clipIds.length > 0);

  const apply = (item: EffectLibraryItem) => {
    if (!seq || item.status !== "ready" || !canApply) return;
    for (const cmd of buildAddEffectCommands(seq.id, clipIds, item)) {
      dispatch(cmd);
    }
  };

  return (
    <div className="ed-panel" data-testid="effects-panel">
      <header className="ed-panel-h">Effects</header>
      <div className="ed-panel-b">
        <p className="ed-hint">
          {canApply
            ? `Apply to ${clipIds.length} selected clip${clipIds.length > 1 ? "s" : ""}.`
            : "Select a clip on the timeline to apply effects."}
        </p>
        <ul className="ed-lib-list dense">
          {EFFECT_LIBRARY.map((item) => {
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
                        ? `Add ${item.label}`
                        : "Select a clip first"
                  }
                  data-testid={`effect-${item.id}`}
                  data-status={item.status}
                  onClick={() => apply(item)}
                >
                  <span className="ed-lib-thumb fx" aria-hidden />
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
