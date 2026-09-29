# OpenCut ↔ PVG adapter layer

```
PVG ProjectDocument (disk)
        │
        ▼
migrateProjectForOpenCutEditor()  ──► unchanged schema (4.2)
        │
        ▼
editorStore + @pvg/editor-core commands  ◄── canonical edit + history
        │
        ├── pvgMediaResourceAdapter (asset_id → scoped URL)
        ├── OpenCutTimelinePanel (OpenCut zoom/ruler UX)
        ├── CanvasViewer / PvgVideoPlayer (program preview)
        └── aiEditorBridge (allowlisted AI → planToCommands)
```

OpenCut `EditorCore` singleton is **not** duplicated in PVG yet; timeline React from `vendor/opencut-classic/apps/web/src/timeline` will be wired through `PvgOpenCutEditorContext` in follow-on milestones.
