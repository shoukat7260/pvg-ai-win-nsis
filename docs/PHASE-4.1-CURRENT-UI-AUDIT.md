# PHASE 4.1 — CURRENT UI AUDIT (expanded)

Companion to `PHASE-4.1-INITIAL-AUDIT.md`. Evidence: user screenshots 2026-09-29.

## Editor (`/app/edit`)

| Problem | Why | Proposed | Implementation | Validation |
|---------|-----|----------|----------------|------------|
| Letter rail | Unprofessional discovery | Icon rail | `EditorRail` + `EditorIcons` | Hover labels; tests |
| Buried AI | Flex stack loses Copilot | Right dock modes | `RightDock` | P4.1-E/G |
| Weak top hierarchy | Flat pills / huge Save | Compact chrome | `EditorTopBar` | Visual |
| Primitive timeline | Flat clips / weak groups | Toolbar groups + tokens | `TimelinePanel` + CSS | Edit regress |
| Small viewer feel | Weak stage chrome | Program header / Fit | `CanvasViewer` | Visual |
| Empty inspector | Dead copy | Sequence summary | `InspectorPanel` | P4.1-J idle |
| Giant create buttons | SaaS density | Grid cards | `TextShapesPanel` | Visual |
| History cards | Low density | Dense rows | `HistoryPanel` | Visual |
| Media drop dominates | Always empty-state | Conditional compact | `MediaPanel` | P4.1-U |

## Settings / About (secondary)

Low-contrast labels and light SaaS cards noted; **deferred** except future token reuse. Phase 4.1 priority is editor workstation.

## Status

Audit complete. Implementation delivered for editor shell. User visual acceptance pending.
