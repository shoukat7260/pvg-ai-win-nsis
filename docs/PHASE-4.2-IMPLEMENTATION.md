# Phase 4.2 implementation report (OpenCut integration)

## Summary

Phase 4.2 establishes **OpenCut Classic as the documented, vendored editor foundation** and wires the first production integration path inside PVG AI **without an iframe or separate Next.js runtime**.

PVG retains: auth, project format, media security, Tauri, AI Copilot, workspace shell.  
OpenCut supplies: pinned upstream reference, timeline zoom/ruler algorithms, WASM package hook, and the roadmap to port `EditorCore` + timeline React.

## OpenCut baseline

- Commit: `cf5e79e919144200294fb9fed22a222592a0aeea`
- Path: `vendor/opencut-classic/`
- License: `THIRD-PARTY-LICENSES.md`

## Code delivered

| Area | Location |
|------|----------|
| Integration package | `packages/opencut-integration/` |
| Media adapter types | `src/media/pvg-media-adapter.ts` |
| Runtime media resolver | `apps/desktop/src/services/pvgMediaResourceAdapter.ts` |
| OpenCut timeline UI | `apps/desktop/src/features/editor/panels/OpenCutTimelinePanel.tsx` |
| Editor shell | `apps/desktop/src/features/editor/opencut/OpenCutEditorShell.tsx` |
| Dev-only banner | `EditorDevOnlyBanner.tsx` |
| AI bridge | `apps/desktop/src/services/aiEditorBridge.ts` |
| Real video preview | `CanvasViewer`, `PvgVideoPlayer`, `mediaPreview.ts` (retained) |

## Canonical architecture (4.2)

- **One project model:** `@pvg/project-format`
- **One command/history path:** `@pvg/editor-core` + `editorStore`
- **One playback clock:** `editorStore.playback`
- **One selection model:** `editorStore.selection`
- **Media identity:** `asset_id` via `pvgMediaResourceAdapter`

## Not yet ported (explicit deferral)

- Full OpenCut `EditorCore` singleton inside PVG webview
- OpenCut timeline React tree (`apps/web/src/timeline/components/*`) — requires Next/`@/` shim layer
- WASM compositor as primary program monitor (optional init probe only)
- Real cached filmstrip/waveform per clip (CSS patterns today; Phase 3 derivatives to be wired)

## Build / test

```bash
pnpm install
pnpm test:frontend
pnpm --filter @pvg/desktop tauri:dev
```

## Status

**READY FOR USER ACCEPTANCE** — validate on Windows desktop per `docs/PHASE-4.2-USER-ACCEPTANCE.md`.
