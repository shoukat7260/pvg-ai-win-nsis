# Phase 4.3B — NLE Completion Matrix

**Date:** 2026-09-30  
**Scope:** OpenCut-derived editor capability vs PVG implementation  
**Verdict:** NLE core edits are largely present in `@pvg/editor-core` + timeline UI; preview/compositor is DOM/`<video>`+CSS (not OpenCut WASM); several CapCut-class surfaces remain PARTIAL or MISSING.  
**Related:** `docs/architecture/PVG-OPENCUT-FEATURE-MATRIX.md`, `docs/PHASE-4.3-STATUS.md`, `vendor/opencut-classic` (pinned baseline only)

### Status legend

| Status | Meaning |
|--------|---------|
| **PASS** | Implemented in PVG code with observable UI and/or unit tests; OpenCut capability covered at PVG quality bar |
| **PARTIAL** | Core model and/or subset of UI works; gaps vs OpenCut or professional NLE expectations |
| **MISSING** | Not implemented in PVG (may exist only as disabled UI or unused command) |
| **DEFERRED** | Explicit product decision to postpone (documented) |

### Audit sources

| Area | Path |
|------|------|
| Integration / zoom / ruler / WASM probe / export plan | `packages/opencut-integration` |
| Timeline commands, composition graph, keyframes | `packages/editor-core` |
| Desktop editor shell / timeline / monitor / panels | `apps/desktop/src/features/editor` |
| Editor store (selection, playback, clipboard) | `apps/desktop/src/state/editorStore.ts` |
| FFmpeg sequence export | `apps/desktop/src-tauri/crates/pvg-media/src/export.rs` |
| Vendored OpenCut Classic (high level) | `vendor/opencut-classic` @ `cf5e79e9…` |
| Ownership decisions | `docs/architecture/PVG-OPENCUT-FEATURE-MATRIX.md` |

---

## Feature matrix

| Feature | OpenCut source/capability | PVG implementation | Status | Test | Known limitation |
|---------|---------------------------|--------------------|--------|------|------------------|
| **Multi-track video** | Multi video tracks; lane headers; clip lanes | Default `V1`/`V2` via `createDefaultTracks()`; lanes + headers in `OpenCutTimelinePanel`; append to video/overlay | **PASS** | `editor-core` fixtures use multi-track; `ensureEditorTracks` | No track reorder / add-track UI |
| **Multi-track audio** | Dedicated audio tracks; mute/solo | Default `A1`/`A2`; mute/solo controls; `composeAtTime` solo gating | **PASS** | `SetTrackPropertyCommand` mute/lock unit test | Program monitor does not play audio (video layers forced `muted`) |
| **Overlay track** | Overlay / upper video layers | Default `Overlay` track type; composition stacks tracks bottom→top | **PASS** | Composition unit tests | Overlay not visually distinct beyond track type pill |
| **Text track** | Text / title elements | Default `Text` track; `createTextClip`; Title/Subtitle/Caption create flows | **PASS** | Manual caption UI test ids; composition text layers | Caption styles / SRT / auto captions not shipped |
| **Selection** | SelectionManager; multi-select | `editorStore.selection`; click + Shift multi-select on clips; inspector multi-edit | **PASS** | Desktop editor tests select clips for effects | `keyframeIds` / `markerIds` selection fields unused in UI |
| **Drag (horizontal move)** | Element drag with live ghost | Mouse-down move → `MoveClipsCommand`; linked/group expansion in core | **PASS** | `moveClips` + undo unit test | No live clip ghost during drag (snap-guide ms only); commits on mouseup |
| **Trim** | Edge trim / source bounds | Left/right `.trim-handle` → `TrimLeftCommand` / `TrimRightCommand` | **PASS** | `trims left and right with source bounds` | Trim updates only on mouseup (no live edge preview) |
| **Split** | Razor / split at playhead | `SplitAtPlayheadCommand`; shortcut `S`; command palette | **PASS** | `splits clip at playhead without duplicating media` | Razor tool mode exists in types (`EditMode`) but timeline always select-drag |
| **Delete** | Delete / clear gap | `DeleteClipsCommand`; context menu confirm; Delete/Backspace; linked A/V remove | **PASS** | delete linked audio unit test; command palette | Confirm dialog is `window.confirm` (crude UX) |
| **Duplicate** | Duplicate / clone element | `DuplicateClipsCommand` + AI `duplicate_clip`; **copy/paste** (`Ctrl/Cmd+C/V`) via `serializeClipboard` / `pasteClipboard` | **PARTIAL** | AI plan local path for duplicate; clipboard helpers in core | No dedicated Duplicate shortcut/command-palette entry; paste appends to typed track, not exact lane copy |
| **Move (cross-track)** | Drag to another track | `MoveClipsToTrackCommand` in editor-core | **PARTIAL** | `MoveClipsToTrackCommand relocates clip` unit test | **No timeline UI** for vertical track relocate; only same-track Δt drag |
| **Snap** | Magnetic snap to cuts/markers | `timelineUi.snapEnabled`; toolbar + `M`; `snapTargetsMs` / `snapValue` in move | **PASS** | Exercised via move with snap option | Snap threshold not user-configurable; guide is text, not full magnetic line overlay |
| **Ripple** | Ripple delete / ripple trim-move | `rippleMode` toggle; `RippleDeleteCommand` when ripple ON | **PARTIAL** | `ripple deletes middle clip and closes gap`; history ripple test | Ripple does **not** apply to move/trim — delete only |
| **Roll edit** | Roll trim across cut | `RollEditCommand` / `rollEdit` in core | **MISSING** | Unit test only (`roll preserves A+B total duration`) | No UI / shortcut |
| **Markers** | Marker track / manage | `AddMarkerCommand`; `N`; ruler ticks; command palette | **PARTIAL** | Command exists; markers in snap targets | Display-only; no select/edit/delete/rename UI; `selection.markerIds` unused |
| **Playhead** | Scrub + sync playback | Ruler scrub; `playhead` div; store clock; J/K/L + arrows; program ±1f | **PASS** | `data-testid="playhead"`; CanvasViewer RAF clock | Dual RAF clocks in workspace + viewer (redundant but functional) |
| **Zoom** | OpenCut zoom levels / fit | Ported `zoom-utils` / ruler; slider ± / Fit; palette zoom | **PASS** | `opencut-integration` ruler/zoom tests | Zoom state is PVG scalar mapped to OpenCut levels — not full OpenCut EditorCore zoom stack |
| **Scroll** | Timeline scroll sync / follow playhead | Native overflow scroll on `.timeline-scroll` | **PARTIAL** | — | `timelineUi.scrollMs` defined but **never written/read** in UI; no playhead-follow scroll |
| **Track lock** | Lock prevents edits | Header `L` → `SetTrackPropertyCommand`; drag aborts when locked; core throws on locked move | **PASS** | mute/lock unit test | Locked styling only; no lock icon set beyond `L` chip |
| **Track visibility** | Hide track from preview | Header `V` for non-audio; `composeAtTime` skips `!visible` | **PASS** | Composition filters visible | Export plan also skips invisible tracks |
| **Track mute** | Mute audio | Header `M` on audio tracks; export/composition skip muted | **PASS** | SetTrackProperty mute test | Video embedded audio mute is track-level only; preview video always muted anyway |
| **Track solo** | Solo audio | Header `S`; `composeAtTime` solo exclusivity for audio | **PASS** | Logic in `composition.ts` | Solo not reflected in program audio (no audio playback path) |
| **Program monitor** | WASM/GPU compositor preview | `CanvasViewer` + `composeAtTime` + stacked `CompositionLayer` (`<video>` / img / text / shape) | **PARTIAL** | `data-testid="canvas-viewer"` / `program-stage` | Multi-`<video>` DOM stack; **muted**; CSS filter approx for effects; not frame-accurate GPU comp |
| **Keyframes** | Full keyframe UI + channels | Model + `evaluateKeyframes` / motion presets; `AddKeyframeCommand`; inspector “Keyframe opacity”; applied in `composeAtTime` | **PARTIAL** | keyframe interpolate + compose opacity tests | No graph/timeline keyframe editor; only opacity one-click; limited property UI |
| **Transitions** | Dissolve/fade/wipe/etc. in preview+export | Library + `SetTransitionCommand`; fade/dissolve opacity in `composeAtTime`; FFmpeg fade in/out on export | **PARTIAL** | `phase43-editor-p2` transition ready/unavailable; catalog builders | Wipe/slide/dip stored; preview only approximates fade/dissolve; Zoom transition **unavailable** |
| **Effects** | GPU/WASM effect stack | Ready set: blur, brightness/contrast, saturation, sharpen, opacity, exposure, vignette, grayscale via `AddEffectCommand`; CSS preview + FFmpeg `effects_to_vf` | **PARTIAL** | Effects panel + catalog tests | Catalog marks many as unavailable; CSS ≠ FFmpeg parity; sharpen/vignette weak in CSS |
| **Color** | Color wheels / curves / LUT | Color panel = color-related `AddEffectCommand`s (exposure, sat, temp, tint, …) | **PARTIAL** | Color library wiring in phase43 tests | No curves, wheels, or LUT; “foundation” only (panel comment) |
| **Text** | Rich title editor | `createTextClip` + inspector text path; DOM text layer; export ASS/`drawtext` path | **PARTIAL** | Text in export composition plan test | Limited typography UI; program font size scaled heuristically |
| **Captions** | Auto captions / SRT / styles | `CaptionsPanel`: **Manual** → text clip at playhead | **PARTIAL** | `captions-manual` test id | Auto / Import SRT / Styles explicitly disabled (“Not yet available”) |
| **Audio / waveform** | Waveform on clips; mixer | `ClipDerivativeVisuals` waveform/filmstrip from derivatives; audio tracks + volume on clip model | **PARTIAL** | `clip-waveform` / media waveform job types | Waveform is derivative image if generated; **no program audio monitor**; no mixer UI |
| **Export** | mediabunny / WASM export flows | `ExportModal` → `media_export_sequence` → FFmpeg filter_complex (video+text+audio); `buildExportCompositionPlan` for plan preview | **PASS** | Rust `export.rs` tests; composition-plan vitest | Browser export blocked by design; Windows UAT still PENDING (`PHASE-4.3-STATUS`); complex effects/transitions subset only |
| **History / undo** | CommandManager | PVG `HistoryStack` + commands; Ctrl+Z / Shift+Z; History panel | **PASS** | Multiple undo unit tests | — |
| **OpenCut WASM compositor** | `rust/wasm` GPU compositor + effects | `ensureOpenCutWasm()` dynamic import probe only; shell proceeds regardless of availability | **DEFERRED** | Probe returns boolean; no render path | Not wired to monitor or export; see decision § below |
| **Browser / web editor** | Next.js OpenCut web app | Desktop-first Tauri; `/app/edit` in app shell | **DEFERRED** | — | Per feature matrix: defer web prod |

---

## Summary counts

| Status | Count |
|--------|------:|
| **PASS** | **18** |
| **PARTIAL** | **13** |
| **MISSING** | **1** |
| **DEFERRED** | **2** |
| **Total rows** | **34** |

Counts are for the matrix rows above (honest code-evidence audit, not UAT).

---

## Evidence notes (selected)

### What OpenCut Classic provides (vendor, high level)

Pinned at `OPENCUT_PINNED_COMMIT` (`cf5e79e919144200294fb9fed22a222592a0aeea`) under `vendor/opencut-classic`:

- Full React timeline (elements, keyframe box-select, drag controllers)
- Command-oriented edits + clipboard including keyframes
- Rust/WASM compositor, effects, masks (`rust/`, `docs/effects-renderer.md`, `docs/keyframes.md`)
- Web app + experimental GPUI desktop

PVG does **not** mount the OpenCut web app or iframe. Integration is selective: zoom/ruler utils, baseline pin, WASM probe, composition-plan helper (`packages/opencut-integration`).

### What PVG owns (aligned with feature matrix)

From `PVG-OPENCUT-FEATURE-MATRIX.md`: project container, media adapter, playback clock, selection, undo, AI, FFmpeg/proxy, workspace shell — **PVG owned**. Timeline UI **reuse OpenCut incrementally**. Preview/compositor: **hybrid** (real `<video>` now; WASM later). Export was marked DEFER in 4.2; **4.3 desktop FFmpeg export is implemented**.

### Core vs UI gap pattern

Several operations are **PASS in `@pvg/editor-core`** but only **PARTIAL/MISSING in UI**:

| Core API | UI |
|----------|-----|
| `MoveClipsToTrackCommand` | No vertical drag |
| `RollEditCommand` | None |
| `DuplicateClipsCommand` | AI / copy-paste only |
| Keyframe evaluate + `AddKeyframeCommand` | Opacity button only |
| `scrollMs` | Unused |

---

## Compositor / WASM decision

### Current architecture

1. **Preview:** `composeAtTime(sequence, t)` → resolved layers → DOM stack (`CompositionLayer`: `<video>` / `<img>` / text / shape) with CSS `filter` + opacity. Playback clock is Zustand `editorStore.playback`.
2. **Export:** Tauri `export_sequence_mp4` builds FFmpeg `filter_complex` (scale/rotate/opacity/effects/fade + ASS text + audio mix).
3. **WASM:** `ensureOpenCutWasm()` tries `import("opencut-wasm")` and records availability. Nothing consumes the module for frames or effects.

### Recommendation (Phase 4.3B → 4.x)

**Prefer DOM/canvas + FFmpeg. Do not adopt OpenCut WASM as the primary compositor for this phase.**

| Criterion | DOM/`<video>` + FFmpeg | OpenCut WASM |
|-----------|------------------------|--------------|
| Fits PVG ownership | Yes — PVG clock, selection, project-format | High coupling to OpenCut EditorCore / media ids |
| Works today | Yes — program monitor + export path | Probe only; no product surface |
| Desktop packaging | Tauri already ships FFmpeg workflow | Extra WASM binary, GPU/driver variance, sync with pinned classic commit |
| Risk | Multi-video sync / mute / CSS≠export parity | Large migration; conflicts with local-first `asset_id` model |
| CapCut-class polish later | Canvas 2D/WebGL effects layer **on top of** PVG composition graph | Optional **later** adapter if GPU preview becomes P0 |

**Decision record**

- **Preview:** Keep multi-layer DOM/`<video>` (optionally evolve to a single canvas blit driven by the same `ResolvedLayer[]` graph).
- **Export:** Keep FFmpeg as source of truth for final pixels/audio.
- **WASM:** Remain **DEFERRED** until a concrete gap (e.g. real-time masks, GPU-only effects) cannot be closed with canvas + FFmpeg filters — then integrate behind the existing `composeAtTime` contract, not by embedding OpenCut’s web compositor wholesale.

---

## Gaps to close next (priority order)

1. Program **audio** playback path (unmute dedicated audio or video-linked stems; respect mute/solo).
2. Cross-track **move** UI + optional roll-edit handles.
3. Ripple for **trim/move** (or rename UI to “Ripple delete” to match behavior).
4. Marker CRUD; wire `scrollMs` / playhead-follow.
5. Keyframe timeline UI for transform channels already evaluated.
6. Preview/export **parity** for wipe/slide and remaining effects.
7. Captions: SRT import at minimum before auto-captions.

---

*Do not mark Phase 4.3 / 4.3B COMPLETE solely from this matrix. Packaged Windows UAT remains PENDING per `docs/PHASE-4.3-STATUS.md`.*
