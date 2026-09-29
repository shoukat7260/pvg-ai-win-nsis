# PHASE 4.2 — Current UI Defect Audit

**Date:** 2026-09-29  
**Evidence:** User screenshots (Phase 4.1 UAT) + repository inspection  
**Status:** Defect baseline for Phase 4.2

## CURRENT STATE

Editor (Phase 4.1) has a dark token system and RightDock, but:

1. Settings / AppShell main pane is **light** (`bg-[#f7f7f5] text-[#0a0a0a]`).
2. Settings inputs use **dark backgrounds** (`bg-charcoal-900`) **without explicit text color**.
3. Inherited text is `#0a0a0a` → **black text on black input** (critical).
4. Program monitor renders media layers as placeholder boxes: `VIDEO · N ms src`.
5. SourcePreview sets `<video src>` to filesystem/relative paths that browsers cannot load.
6. Timeline clips remain flat rectangles without thumbnail strips / waveforms.
7. No blob/object-URL bridge for browser file-picker imports.

---

## Defect catalog

### D1 — Input contrast (CRITICAL)

| | |
|--|--|
| **PROBLEM** | Entered text invisible / near-invisible in Settings, Connections, Security, Account; risk in any input inheriting light `color` onto dark fill. |
| **ROOT CAUSE** | AppShell sets `text-[#0a0a0a]` on light content; dark inputs omit `color` / placeholder tokens. |
| **EXPECTED** | Explicit input contract: bg, text, placeholder, border, focus, disabled, error. |
| **IMPLEMENTATION** | Shared `--pvg-input-*` tokens + `.pvg-input` / `PvgInput`; migrate settings & editor fields. |
| **TEST** | Automate type-into dark input; assert computed color contrast; UAT P4.2-INPUT. |

### D2 — Program viewer placeholder (CRITICAL)

| | |
|--|--|
| **PROBLEM** | Imported video shows rectangle `VIDEO · ms src`, not footage. |
| **ROOT CAUSE** | `CanvasViewer` never mounts `<video>`; no media-source resolver. |
| **EXPECTED** | Real frames for playable assets; poster/thumbnail while loading; clear error if codec/path unsupported. |
| **IMPLEMENTATION** | `resolveMediaPreviewUrl` + `ProgramMonitor` video element; browser blob registry; Tauri `convertFileSrc` after validated resolve. |
| **TEST** | Synthetic MP4 import → viewer shows non-placeholder; playback/seek sync. |

### D3 — Browser media URL

| | |
|--|--|
| **PROBLEM** | File picker only stores filename stub; no Object URL. |
| **ROOT CAUSE** | ImportBar discards `File` blobs; mock import has no playable bytes. |
| **EXPECTED** | Browser preview plays via `blob:` URLs for picker/drop imports. |
| **IMPLEMENTATION** | `mediaBlobRegistry` keyed by assetId; revoke on remove. |
| **TEST** | Import fixture File → resolve URL starts with `blob:`. |

### D4 — Timeline visual basicness

| | |
|--|--|
| **PROBLEM** | Flat clips; weak ruler; letter track controls. |
| **ROOT CAUSE** | Minimal chrome from Phase 4. |
| **EXPECTED** | Adaptive ruler, type-tinted clips with thumbs/labels, icon track headers, zoom-around-playhead. |
| **IMPLEMENTATION** | Upgrade `TimelinePanel` + CSS; optional thumb from registry/poster. |
| **TEST** | Visual + zoom/scroll sync tests. |

### D5 — Playback / playhead sync

| | |
|--|--|
| **PROBLEM** | No video element clock; playhead moves alone. |
| **ROOT CAUSE** | Playback state updates UI time without media.currentTime. |
| **EXPECTED** | Canonical `playback.currentTimeMs` drives seek; play advances via rAF/video timeupdate. |
| **IMPLEMENTATION** | ProgramMonitor seek on playhead; playing uses video or clock tick. |
| **TEST** | Set playhead → video.currentTime ≈ expected. |

### D6 — CSP may block media

| | |
|--|--|
| **PROBLEM** | `tauri.conf.json` CSP lacks `media-src` for `blob:` / `asset:`. |
| **ROOT CAUSE** | Phase 1 CSP focused on img/connect. |
| **EXPECTED** | `media-src 'self' blob: asset: https://asset.localhost http://asset.localhost` |
| **IMPLEMENTATION** | Update CSP. |
| **TEST** | Video element loads in Tauri/browser without CSP violation. |

### D7 — Settings light vs editor dark inconsistency

| | |
|--|--|
| **PROBLEM** | Split product language (light SaaS shell vs dark NLE). |
| **ROOT CAUSE** | Historical AppShell light main. |
| **EXPECTED** | Phase 4.2: fix inputs; do not full Settings redesign. Editor remains dark. |
| **IMPLEMENTATION** | Input tokens work on light surfaces (`--pvg-input-on-light-*`) and dark editor. |
| **TEST** | Settings + editor both readable. |

---

## Priority order (execution)

1. Input/contrast tokens + shared component  
2. Workspace/input hierarchy polish  
3. Media blob registry + resolver  
4. Real Program monitor video  
5. Playhead sync  
6. Timeline upgrade  
7. Inspector/AI polish  
8. Tests + docs → READY FOR USER ACCEPTANCE  
