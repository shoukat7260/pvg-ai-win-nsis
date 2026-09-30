import { useEditorStore } from "@/state/editorStore";
import {
  COLOR_LIBRARY,
  buildAddEffectCommands,
  type ColorLibraryItem,
} from "./libraryCatalog";

/**
 * Color panel foundation — dispatches AddEffectCommand for color-related
 * effect types already in @pvg/editor-core / project-format. Curves / LUT /
 * wheels stay labeled unavailable until dedicated commands exist.
 */
export function ColorPanel() {
  const seq = useEditorStore((s) => s.getActiveSequence());
  const selection = useEditorStore((s) => s.selection);
  const dispatch = useEditorStore((s) => s.dispatch);
  const clipIds = selection.clipIds;
  const canApply = Boolean(seq && clipIds.length > 0);

  const apply = (item: ColorLibraryItem) => {
    if (!seq || item.status !== "ready" || !canApply) return;
    for (const cmd of buildAddEffectCommands(seq.id, clipIds, item)) {
      dispatch(cmd);
    }
  };

  return (
    <div className="ed-panel" data-testid="color-panel">
      <header className="ed-panel-h">Color</header>
      <div className="ed-panel-b">
        <p className="ed-hint">
          {canApply
            ? `Color adjustments on ${clipIds.length} selected clip${clipIds.length > 1 ? "s" : ""}.`
            : "Select a clip to add color adjustments."}
        </p>
        <ul className="ed-lib-list dense">
          {COLOR_LIBRARY.map((item) => {
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
                  data-testid={`color-${item.id}`}
                  data-status={item.status}
                  onClick={() => apply(item)}
                >
                  <span className="ed-lib-thumb color" aria-hidden />
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
