# PHASE 4.2B — OpenCut / PVG Editor Audit

**Date:** 2026-09-30  
**Upstream classic:** https://github.com/OpenCut-app/opencut-classic @ `cf5e79e919144200294fb9fed22a222592a0aeea` (MIT)  
**Official rewrite:** https://github.com/OpenCut-app/OpenCut — ground-up Rust-core rewrite (Editor API / plugins / MCP **in progress**, not a drop-in for PVG Tauri today).  
**Decision:** PVG-maintained OpenCut-*derived* editor. Canonical domain model remains `@pvg/project-format` + `@pvg/editor-core`. OpenCut classic supplies timeline UX algorithms, interaction patterns, and future WASM compositor path — **not** a second competing timeline store, and **not** Next.js/iframe.

---

## What already works

| Area | Status |
|------|--------|
| Phase 1–3 security, auth, media import, proxy/thumb/waveform FFmpeg | Working |
| Phase 4 `@pvg/editor-core` commands (move/trim/split/ripple/undo/speed/keyframes/effects/transitions) | Substantial |
| Phase 4.1 workspace shell (rail, RightDock, Inspector/AI, tokens) | Working |
| Phase 4.2 OpenCut vendor + `@pvg/opencut-integration` zoom/ruler | Working |
| Real `<video>` program preview for primary layer | Working (blob/Tauri resolve) |
| AI Copilot allowlisted plans → commands | Working |
| Browser `/app/edit` | Dev/QA only + banner |
| Production web | No editor route |

---

## Duplicates / incomplete

| Issue | Decision |
|-------|----------|
| `TimelinePanel.tsx` + `OpenCutTimelinePanel.tsx` | **REMOVE** legacy after 4.2B timeline is proven |
| OpenCut `EditorCore` singleton vs PVG `editorStore` + `@pvg/editor-core` | **PVG OWNED** canonical; do **not** dual-run OpenCut EditorCore |
| Track mute/solo/lock/visibility UI | Buttons present but often **non-mutating** → **IMPLEMENT** |
| Multi-layer compose | `composeAtTime` exists; CanvasViewer shows **primary media only** → **IMPLEMENT** compositor stack |
| Filmstrip / waveform | CSS patterns only → wire Phase 3 derivatives |
| Export | **MISSING** → implement FFmpeg-validated export |
| Interactive canvas handles | **MISSING** |
| Keyframe / effect / transition inspector depth | Partial → complete |
| Caption system | Schema has caption tracks; UI incomplete |
| Windows installer | Must wait for acceptance gate |

---

## Reuse / replace / adapt / remove

**Reuse:** `@pvg/editor-core`, project-format sequences, Phase 3 media/FFmpeg, Phase 4.1 shell, OpenCut zoom/ruler, media preview resolver.  
**Adapt:** OpenCut timeline interaction density into `OpenCutTimelinePanel`; OpenCut effect/transition naming where helpful.  
**Replace:** Placeholder timeline visuals; primary-only preview; dead track controls.  
**Remove:** Unused legacy timeline; any path toward iframe/Next server.  
**Do not import:** OpenCut better-auth, Drizzle cloud, Next.js production runtime, rewrite GPUI desktop.

---

## Must implement (4.2B gate)

1. Track property commands + wired headers  
2. Cross-track move / overwrite / insert edits where core allows  
3. Multi-layer program compositor (video + image + text + shape) with transforms  
4. Real derivative thumbnails/waveforms on clips  
5. Keyframe add/delete + inspector + compose evaluation (already in core)  
6. Speed presets UI  
7. Audio volume/fade UI + mute/solo track  
8. Text inspector completeness  
9. Effects & transitions apply + preview CSS filters  
10. **Real export** via Tauri FFmpeg argv builder  
11. Save/load of full sequence state (already mostly present — verify)  
12. Download-for-Windows UI (inactive until artifact exists)  
13. Expanded automated + fixture media tests  
14. Cleanup legacy timeline  
15. Final report — STATUS **NOT READY** until gate items pass (installer only after)

---

## Risks

- Full classic `apps/web` React tree is Next/`@/` coupled → extract logic, not the app shell.  
- WASM compositor optional; HTML/CSS/`<video>` composition is production path for 4.2B.  
- Export of complex multi-layer timelines is hard; ship validated “sequence flatten” export with honest limitations.  
- Cross-compile Windows installer on Linux VPS needs toolchain (mingw/nsis or CI) — document if blocked.

---

## Windows concerns

- Source stays on VPS; user downloads installer later.  
- Do **not** build installer until editor acceptance tests pass.  
- Artifact: `artifacts/windows/PVG-AI-Setup-x64.exe` + `release.json` + SHA-256.
