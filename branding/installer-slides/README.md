# PVG AI installer storytelling slides

Original PVG-branded visuals for NSIS / first-run storytelling.

**Do not** use CapCut screenshots, trademarks, or proprietary artwork.

| File | Message |
|------|---------|
| `01-professional-editing.svg` | Professional editing |
| `02-ai-video.svg` | AI video generation |
| `03-ugc-ads.svg` | UGC Ads |
| `04-timeline.svg` | Advanced timeline |
| `05-voice-captions.svg` | Voice + captions |
| `06-ai-workspace.svg` | AI workspace |

Mirrored under `apps/desktop/public/installer-slides/` for in-app use.

## NSIS feasibility (Tauri 2)

Stock Tauri NSIS (`tauri.conf.json` → `bundle.windows.nsis`) supports install mode and icons, but **not** CapCut-style multi-slide storytelling without a **custom NSIS template**. Wiring these SVGs as live installer pages is therefore **PARTIAL / deferred** until a custom template is approved.

Until then: keep functional NSIS install; use these assets for post-install / about / marketing surfaces; convert to PNG header/sidebar only when a custom template lands.

## Phase 4.3D decision

**INSTALLER STORYTELLING: PARTIAL / DEFERRED**

A custom NSIS template is technically possible but disproportionately complex and risks installer instability relative to benefit. The stable Tauri NSIS installer (icons, install mode, WebView2 bootstrapper) remains the production path for 0.1.3.

