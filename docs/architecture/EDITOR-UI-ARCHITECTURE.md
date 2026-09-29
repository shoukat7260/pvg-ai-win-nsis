# Editor UI Architecture — Phase 4.1

## Shell

```
EditorWorkspace
├── EditorKeyboardLayer
├── EditorTopBar          (brand, breadcrumb, workspace preset, undo/redo/save)
├── ed-body
│   ├── EditorRail        (icon tools + AI shortcut)
│   └── EditorMain
│       ├── Left browser  (Media / Text / Transitions / Effects / History)
│       ├── Center        (CanvasViewer + TimelinePanel, vertical resize)
│       └── RightDock     (Inspector | Split | AI)
├── StatusBar
└── CommandPalette
```

## State

`editorStore` (`apps/desktop/src/state/editorStore.ts`):

- Document / selection / playback / history — Phase 4 (unchanged model)
- `panels: EditorLayoutPanels` — widths, heights, collapse, `inspectorSplitPct`, `railExpanded`
- `rightDockMode: "inspector" | "ai" | "split"`
- `workspacePreset: "editor" | "media" | "ai"`
- Persistence key: `localStorage` → `pvg-editor-layout-v41`
- `resetWorkspaceLayout()` restores PVG Editor defaults

## Panel system

- Horizontal dividers: left browser ↔ center; center ↔ right dock  
- Vertical: viewer ↔ timeline; inspector ↔ AI (split mode)  
- Min/max clamps in resize helpers (`startResizeX` / `startResizeY`)  
- Collapse via rail / dock / command palette; uncollapse affordinces on edges

## Focus / keyboard

- Timeline/canvas shortcuts when not typing in AI or numeric fields  
- Ctrl/Cmd+K command palette; Ctrl/Cmd+S save; undo/redo preserved  
- AI input pinned — typing does not steal timeline keys when focused (browser default)

## Selection → Inspector

- 0 clips → Sequence inspector  
- 1+ clips → contextual Transform / Speed / Transition / Effects (+ Typography for text)  
- Multi: Mixed values; commits apply to all selected  

## AI Copilot

See `docs/architecture/AI-COPILOT-UI-ARCHITECTURE.md`. Commands remain allowlisted via `@pvg/editor-core`.

## Design tokens

Imported via `editor.css` → `styles/editor-tokens.css`. No competing layout engines.
