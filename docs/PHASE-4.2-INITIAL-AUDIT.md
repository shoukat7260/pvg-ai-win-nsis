# PHASE 4.2 — Initial Audit Summary

See `PHASE-4.2-CURRENT-UI-AUDIT.md` for full defect table.

**Critical defects:**

1. Black-on-black form inputs (AppShell light text + dark input bg).  
2. Program monitor placeholder instead of real video.  
3. No secure/browser-safe media URL pipeline for editor preview.  
4. Timeline still visually primitive vs professional NLE target.

**Non-goals:** Auth rewrite, billing rewrite, media DB rewrite, Phase 5 features.

**Approach (updated):** OpenCut Classic vendored at `cf5e79e…`; `@pvg/opencut-integration` adapters; OpenCut timeline zoom/ruler UX; PVG project + `@pvg/editor-core` remain canonical persistence/commands; full OpenCut `EditorCore` React port is incremental.

## OpenCut Classic (reference audit)

- **Editor engine:** `apps/web/src/core` — singleton `EditorCore` (timeline, playback, media, renderer, commands)
- **Timeline UI:** `apps/web/src/timeline` — store, hooks, components (Next.js + `@/` imports)
- **Preview:** `apps/web/src/preview`, `services/renderer` — canvas + WASM compositor
- **WASM:** `rust/wasm` → npm `opencut-wasm`
- **Not imported into PVG runtime:** Next.js server, better-auth cloud DB, Drizzle backend

## PVG (retained ownership)

- Auth, billing, providers, Tauri FS security, `ProjectDocument`, `MediaAsset`, AI Copilot, workspace shell
