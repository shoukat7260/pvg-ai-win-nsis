# Video Preview Architecture — Phase 4.2

## Goal

Program monitor shows **real footage** for imported playable assets — not `VIDEO · ms src` placeholders.

## Pipeline

```
assetId
  → mediaBlobRegistry (browser File pick → blob:)
  OR media_resolve_preview (Tauri: validate project + asset → absolute path)
  → convertFileSrc (Tauri asset protocol)
  → <video> / <img> in Program monitor
```

## Components

| Piece | Path |
|-------|------|
| Blob registry | `apps/desktop/src/services/mediaBlobRegistry.ts` |
| Resolver | `apps/desktop/src/services/mediaPreview.ts` |
| Player | `apps/desktop/src/features/editor/media/PvgVideoPlayer.tsx` |
| Program UI | `CanvasViewer` (Program monitor) |
| Native resolve | `media_resolve_preview` in `media_cmd.rs` |

## Security

- No arbitrary `file://` or whole-drive HTTP serving.
- Tauri: path only after project-scoped asset validation; asset protocol scope limited to app data / `/tmp/PVG`.
- Browser: only Object URLs from user File picker / drop — revoked on asset remove.
- LINK files outside asset scope may require proxy under project for native preview.

## Browser vs Tauri

| Environment | Playable transport |
|-------------|-------------------|
| Browser (`localhost:1420`) | `blob:` after File import this session |
| Tauri shell | `asset:` via `convertFileSrc` after `media_resolve_preview` |

## Playback sync

Canonical clock: `editorStore.playback.currentTimeMs`.

- Scrub / frame step → video `currentTime` = clip `sourceTimeMs / 1000`
- Play → rAF advances store clock; video seeks to matching source time

## Limitations

- Multi-layer simultaneous live video decode not implemented (primary video layer only).
- Stacked additional video layers show compact badge.
- Codec support depends on browser/OS decoder; H.264 MP4 recommended for UAT.
- Waveform/thumbnail strips on timeline use patterned CSS foundation; Phase 3 derivative images wire when paths resolve.
