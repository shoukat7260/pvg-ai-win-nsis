# Media adapter (Phase 4.2)

Canonical identity: **PVG `asset_id`**.

Implementation:

- Types: `packages/opencut-integration/src/media/pvg-media-adapter.ts`
- Runtime: `apps/desktop/src/services/pvgMediaResourceAdapter.ts` → `resolveMediaPreviewUrl`

Rules:

- No raw absolute paths in webview `src`
- Tauri: `media_resolve_preview` + `convertFileSrc`
- Browser dev: blob URLs from File import only
- Proxy/original: `PreviewSource` preference honored

OpenCut internal media IDs map through `OpenCutMediaIdMap` when EditorCore media manager is connected.
