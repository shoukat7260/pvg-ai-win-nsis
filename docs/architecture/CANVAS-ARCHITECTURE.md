# Canvas Architecture

Program monitor evaluates `composeAtTime(sequence, timeMs)` → `ResolvedLayer[]`.

Layers include video/image/text/shape with animated transform properties.
Selection is shared with timeline/inspector via `editorStore.selection`.

Rendering strategy (Phase 4): DOM overlays inside a letterboxed stage (fast enough for overlays/text; media shown as placeholders with source time). Future: WebGL/WebGPU compositor behind the same `ResolvedLayer` interface.

Guides: title-safe / action-safe overlays (not baked into export).
