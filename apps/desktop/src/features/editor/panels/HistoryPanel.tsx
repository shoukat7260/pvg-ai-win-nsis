import { useEditorStore } from "@/state/editorStore";

export function HistoryPanel() {
  const labels = useEditorStore((s) => s.historyLabels);
  const undo = useEditorStore((s) => s.undo);

  return (
    <div className="ed-panel" data-testid="history-panel">
      <header className="ed-panel-h">History</header>
      <div className="ed-panel-b">
        {labels.length === 0 ? (
          <p className="ed-hint">No edits this session.</p>
        ) : (
          <ul className="ed-history-list">
            {labels.map((label, i) => (
              <li key={`${label}-${i}`}>
                <button
                  type="button"
                  className="ed-history-row"
                  onClick={() => {
                    if (i === 0) undo();
                  }}
                  title={i === 0 ? "Undo this change" : undefined}
                >
                  <span className="ed-history-icon" aria-hidden>
                    ◇
                  </span>
                  <span className="ed-history-label">{label}</span>
                  {i === 0 ? <span className="ed-history-meta">latest</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
