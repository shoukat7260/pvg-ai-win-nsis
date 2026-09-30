import { useEditorStore } from "@/state/editorStore";
import {
  IconAi,
  IconCaptions,
  IconColor,
  IconEffects,
  IconHistory,
  IconMedia,
  IconProject,
  IconText,
  IconTransition,
} from "./icons/EditorIcons";

const RAIL: Array<{
  id:
    | "media"
    | "project"
    | "text"
    | "transitions"
    | "effects"
    | "color"
    | "history"
    | "captions";
  label: string;
  shortcut?: string;
  Icon: (p: { className?: string }) => React.ReactElement;
}> = [
  { id: "media", label: "Media", shortcut: "", Icon: IconMedia },
  { id: "project", label: "Project", Icon: IconProject },
  { id: "text", label: "Text & Shapes", Icon: IconText },
  { id: "captions", label: "Captions", Icon: IconCaptions },
  { id: "transitions", label: "Transitions", Icon: IconTransition },
  { id: "effects", label: "Effects", Icon: IconEffects },
  { id: "color", label: "Color", Icon: IconColor },
  { id: "history", label: "History", Icon: IconHistory },
];

export function EditorRail() {
  const leftPanel = useEditorStore((s) => s.leftPanel);
  const setLeftPanel = useEditorStore((s) => s.setLeftPanel);
  const panels = useEditorStore((s) => s.panels);
  const patchPanels = useEditorStore((s) => s.patchPanels);
  const setRightDockMode = useEditorStore((s) => s.setRightDockMode);
  const rightDockMode = useEditorStore((s) => s.rightDockMode);
  const expanded = panels.railExpanded;

  return (
    <nav
      className={`ed-rail ${expanded ? "expanded" : ""}`}
      aria-label="Tool rail"
      data-testid="editor-rail"
    >
      <button
        type="button"
        className="ed-rail-toggle"
        title={expanded ? "Collapse rail" : "Expand rail"}
        aria-label={expanded ? "Collapse rail" : "Expand rail"}
        onClick={() => patchPanels({ railExpanded: !expanded })}
      >
        {expanded ? "«" : "»"}
      </button>

      {RAIL.map((item) => {
        const active = leftPanel === item.id && !panels.leftCollapsed;
        return (
          <button
            key={item.id}
            type="button"
            className={`ed-rail-btn ${active ? "active" : ""}`}
            title={item.label}
            aria-label={item.label}
            aria-pressed={active}
            onClick={() => {
              if (active) {
                patchPanels({ leftCollapsed: true });
              } else {
                setLeftPanel(item.id);
                patchPanels({ leftCollapsed: false });
              }
            }}
          >
            <item.Icon />
            {expanded ? <span>{item.label}</span> : null}
          </button>
        );
      })}

      <div className="ed-rail-spacer" />

      <button
        type="button"
        className={`ed-rail-btn ${!panels.rightCollapsed && rightDockMode !== "ai" ? "active" : ""}`}
        title="Inspector"
        aria-label="Toggle inspector"
        onClick={() => {
          if (panels.rightCollapsed) {
            patchPanels({ rightCollapsed: false });
            setRightDockMode("split");
          } else if (rightDockMode === "ai") {
            setRightDockMode("split");
          } else {
            setRightDockMode("inspector");
          }
        }}
      >
        <span className="ed-rail-glyph" aria-hidden>
          ☰
        </span>
        {expanded ? <span>Inspector</span> : null}
      </button>

      <button
        type="button"
        className={`ed-rail-btn ai ${!panels.rightCollapsed && (rightDockMode === "ai" || rightDockMode === "split") ? "active" : ""}`}
        title="AI Copilot"
        aria-label="Open AI Copilot"
        data-testid="rail-ai"
        onClick={() => {
          patchPanels({ rightCollapsed: false });
          setRightDockMode(rightDockMode === "ai" ? "split" : "ai");
        }}
      >
        <IconAi />
        {expanded ? <span>AI Copilot</span> : null}
      </button>
    </nav>
  );
}
