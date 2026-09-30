# Phase 4.3C — Final Report

**Version:** 0.1.2 (not bumped)  
**Date:** 2026-09-30  
**STATUS:** **NOT READY**

Windows release / 0.1.3 must wait until human UAT and remaining limitations below are accepted or closed.

---

## Executive summary

Phase 4.3C closed the release-critical editor gaps called out after 4.3B:

- Program monitor **audio** (mute/solo/volume, dedicated A-tracks + embedded video audio with dedupe)
- **Keyframe** multi-property UI + delete list + preview interpolation + **export bake** (mid-clip) + speed/flip/reverse in FFmpeg export
- Timeline: **duplicate**, **cross-track move**, **ripple delete**, **roll** (Alt+trim), **markers** select/delete, **scrollMs** + playhead follow
- Transitions: wipe/slide marked **unavailable** (no fake UI); fade/dissolve/dip remain ready
- Automated tests expanded (desktop 4.3C suite + export keyframe/speed test)

**Not done / not claimed:**

- Full continuous keyframe path animation in export (mid-clip sample only)
- OpenCut WASM compositor (intentionally deferred)
- Custom CapCut-style multi-slide NSIS (stock Tauri constraint; SVG assets ready)
- Windows manual UAT / 0.1.3 GitHub Actions release

---

## Architecture (canonical)

```
PVG Project → Sequence → Tracks → Clips
        → @pvg/editor-core (SSOT + commands/history)
        → OpenCut-derived timeline UX
        → composeAtTime → Program monitor (DOM/<video> + ProgramAudioBus)
        → FFmpeg multi-layer export (pvg-media)
```

One timeline state, one playback clock (`editorStore.playback`), one selection model, one history stack.

---

## Previously PARTIAL / MISSING / DEFERRED — closure

| Feature | Previous | Current | Implementation | Test | Evidence |
|---------|----------|---------|----------------|------|----------|
| Program monitor audio | PARTIAL | PASS | `ProgramAudioBus` + `CompositionLayer` mute/volume; solo via `composeAtTime` | phase43c + manual | `ProgramAudioBus.tsx`, `CanvasViewer.tsx` |
| Keyframes UI | PARTIAL | PASS | Multi-prop ◇ buttons at playhead; list + `DeleteKeyframeCommand` | phase43c | `InspectorPanel.tsx` |
| Keyframes export | PARTIAL | PASS* | Rust `evaluate_keyframes` + mid-clip bake; speed/hflip/vflip/reverse | `keyframe_bake_and_speed_flip_export` | `export.rs` |
| Duplicate | PARTIAL | PASS | Ctrl+D, palette, context menu | phase43c | `DuplicateClipsCommand` wired |
| Cross-track move | PARTIAL | PASS | Vertical drop → `MoveClipsToTrackCommand` | phase43c | `OpenCutTimelinePanel.tsx` |
| Ripple | PARTIAL | PASS | Ripple mode + ripple delete; ripple move/trim UNSUPPORTED | existing + palette | toolbar + Delete |
| Roll | MISSING | PASS | Alt+drag right trim → `RollEditCommand` | phase43c | timeline trim handle |
| Markers | PARTIAL | PASS | Click select; Delete / context → `RemoveMarkerCommand` | phase43c | timeline ruler |
| Scroll / follow | PARTIAL | PASS | `scrollMs` write/read; follow while playing | — | timeline scroll |
| Transitions wipe/slide | PARTIAL | UNSUPPORTED | Catalog `unavailable` | phase43c | `libraryCatalog.ts` |
| Export multi-layer | PASS* | PASS | + bake/speed/flip/audio dedupe | export tests | `export.rs` |
| OpenCut WASM | DEFERRED | DEFERRED | DOM+FFmpeg retained | — | closure matrix |
| Browser editor | DEFERRED | DEFERRED | — | — | — |
| Custom NSIS slides | PARTIAL | PARTIAL | Stock Tauri NSIS; SVG story assets present | — | `branding/installer-slides/` |

\*Export keyframes: mid-clip sample, not continuous motion curves.

---

## Subsystems

### Timeline
Multi-track video/audio, select/multi-select, drag, trim L/R, split, delete, ripple delete, duplicate, cross-track move, lock/mute/solo/visibility, snap, markers, playhead, zoom, scroll, roll (Alt), context menu.

### Compositor / playback
`composeAtTime` drives layers; RAF clock; frame step; rate from store; video + text + shapes + effects CSS; audio bus syncs to clock.

### Keyframes
Properties: x/y/scaleX/scaleY/rotation/opacity. Add at playhead, delete, linear/easeIn/easeOut/hold, undo via history, persist in project JSON, preview via composeAtTime, export mid-bake.

### Audio
Import/trim/split/move via timeline; volume/mute/solo; program preview + export mix; waveform when derivatives exist.

### Text / effects / transitions
Text preview + ASS export. Ready effects mutate + CSS preview + FFmpeg filters. Fade/dissolve/dip ready; wipe/slide hidden.

### Media derivatives
Phase 3 architecture retained (thumbnails/filmstrips/waveforms when present).

### Project lifecycle
Rename/duplicate/trash/restore/search/sort/thumbnails from 4.3B retained.

### Export / preview parity
Shared composition rules; multi-layer MP4; tests assert file exists + layer counts. Continuous keyframe path still approximated.

### Auth / workspace / templates / installer
4.3–4.3B auth and CapCut-class shell retained. Installer icon + SVG slides ready; custom NSIS pages still blocked by stock Tauri template (documented).

### Tests
- `apps/desktop/src/test/phase43c-nle-closure.test.ts` (6)
- `pvg-media` export: multi-track + keyframe/speed/flip
- Prior 4.3 / 4.3B suites + editor-core 17

---

## Pre-release gate (Phase 38)

| Gate | Status |
|------|--------|
| Auth P0 | PASS (code; Windows UAT pending) |
| Project create/open/reopen | PASS (code) |
| Rename/duplicate/trash/restore | PASS (4.3B) |
| Thumbnail | PASS foundation (browser limits possible) |
| Timeline / multi-track | PASS |
| Preview + audio | PASS |
| Text / effects / transitions (supported set) | PASS |
| Keyframes | PASS* (export mid-bake) |
| Multi-layer export | PASS |
| Typecheck / unit tests | PASS on exercised suites |
| E2E full media fixture play-out | **PENDING** (fixtures not fully automated on CI media) |
| NLE matrix critical PARTIAL | Closed or UNSUPPORTED/DEFERRED reviewed |
| Installer custom storytelling | **PARTIAL** |
| Version 0.1.3 build | **NOT STARTED** (by design) |

---

## Final status rule

**STATUS: NOT READY**

Reasons:

1. Continuous keyframe motion in export remains mid-clip bake (documented limitation).
2. Custom NSIS multi-slide UI not production-complete.
3. Full Windows installer UAT not performed.
4. Version remains **0.1.2**; do **not** ship 0.1.3 until gates + human UAT.

When engineering accepts mid-clip keyframe bake and remaining installer fallback:

→ **READY FOR USER ACCEPTANCE**  
→ **WINDOWS MANUAL UAT: PENDING**

Only after human install/test of the Windows build:

→ **PHASE 4.3 RELEASE CANDIDATE ACCEPTED**
