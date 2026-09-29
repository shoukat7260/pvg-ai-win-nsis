# PHASE 4 — Implementation

**Product:** PVG AI  
**Phase:** 4 — Professional editor core + enterprise desktop UI  
**Date:** 2026-09-29  
**Status:** READY FOR USER ACCEPTANCE (not auto-approved)

## What was built

### Schema / persistence
- `@pvg/project-format` schema **v3** with transform, keyframes, effects, transitions, text/shape, markers, track controls
- Migration **v2 → v3** registered; v1→v2→v3 path preserved
- Rust `CURRENT_PROJECT_SCHEMA_VERSION = 3`
- New IPC: `load_project_document` (full document for editor)

### Editor engine (`@pvg/editor-core`)
- Command/history stack with undo/redo + transaction grouping
- Timeline ops: move, trim, split, delete, ripple delete, roll, link/unlink, group, speed, reverse, freeze foundation, markers
- Keyframe evaluate/interpolate (hold/linear/easeIn/easeOut/bezier) + motion presets
- Composition graph `composeAtTime` for sequence preview layers
- AI allowlisted tools + schema validation + local planner for safe phrases
- Clipboard `PVG_CLIPBOARD_V1`

### Desktop editor UI (`/app/edit`)
- Professional dark editor shell (own PVG identity — not a competitor clone)
- Top bar, tool rail, media panel, canvas/program viewer, timeline, inspector, AI Copilot, status bar
- Resizable/collapsible panels + workspace presets (editor / media / ai; audio/color placeholders)
- Command palette (Ctrl/Cmd+K), keyboard shortcuts (Space/JKL/S/Delete/Undo/Redo/…)
- Media append → timeline; text/shapes; inspector transforms/speed/transitions/effects
- Autosave debounce on command boundaries; dirty detection excludes UI-only changes

## Explicitly deferred / foundation-only
- Full slip/slide edit UI (data model ready via source in/out)
- Full nested/compound clip UX
- Full multi-monitor docking
- Final export/mastering encoder
- Free-form LLM streaming when provider connected (structured local plans work; provider free-form requires Phase 4+.5 wiring — no fake replies)
- Advanced color/VFX/audio mix (Phase 6/7)
- Graph editor full Bezier UI (evaluation engine works; simplified inspector keyframes ship)

## Security
- AI cannot access vault/secrets/shell/filesystem
- AI tools → same command pipeline as UI
- Destructive AI actions require confirmation
- No secrets in AI context, clipboard, or DOM

## How to UAT
1. Launch desktop (browser preview or Tauri)
2. Login / open workspace
3. Create or open a project → opens **Edit** workspace
4. Follow `docs/PHASE-4-USER-ACCEPTANCE.md`
