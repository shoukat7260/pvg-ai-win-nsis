# PHASE 4.2B — OpenCut Final Report

**STATUS: NOT READY** (acceptance gate incomplete — see § Remaining)

Do **not** treat this as “Phase complete” or auto-approved. Human Windows UAT is still required after the remaining gate items land.

---

## 1. Architecture

```
PVG AI Tauri Desktop
  └── PVG Workspace Shell (Phase 4.1)
        ├── Media / tools rail
        ├── Program monitor (multi-layer CompositionLayer)
        ├── OpenCutTimelinePanel (OpenCut zoom/ruler + track mutations)
        ├── Inspector + AI Copilot (RightDock)
        └── Export modal → Tauri media_export_sequence → FFmpeg argv
  └── Canonical model: @pvg/project-format + @pvg/editor-core + editorStore
  └── OpenCut classic: vendored reference + @pvg/opencut-integration utilities
```

**One editor model.** No iframe. No Next.js production runtime. OpenCut rewrite (Editor API / Rust core) is tracked but not adopted as a second store.

## 2. OpenCut source revision

| Field | Value |
|-------|--------|
| Classic upstream | https://github.com/OpenCut-app/opencut-classic |
| Commit | `cf5e79e919144200294fb9fed22a222592a0aeea` |
| License | MIT |
| Official rewrite | https://github.com/OpenCut-app/OpenCut (in progress; not drop-in) |

## 3. License / provenance

Updated:

- `THIRD-PARTY-LICENSES.md`
- `vendor/README.md`
- `docs/architecture/OPENCUT-INTEGRATION-BASELINE.md`
- `docs/architecture/PHASE-4.2B-OPENCUT-AUDIT.md`

## 4. PVG modifications (4.2B)

| Module | Change |
|--------|--------|
| `@pvg/editor-core` | `SetTrackPropertyCommand`, `RemoveTrackCommand`, `MoveClipsToTrackCommand`, `RemoveEffectCommand` |
| `@pvg/project-format` | Expanded effect/transition enums |
| `pvg-media` | `export.rs` — real H.264/AAC sequence export |
| Tauri | `media_export_sequence` command |
| Timeline UI | Track mute/solo/visibility/lock **mutate state** |
| Canvas | Multi-layer `CompositionLayer` with real video/image/text/shape |
| Export UI | `ExportModal` + enabled top-bar Export |
| Cleanup | Removed unused `TimelinePanel.tsx` |
| Browser | Dev banner + **Download Windows** (disabled until artifact exists) |

## 5–14. Feature status (honest)

| Area | Status |
|------|--------|
| Editor core commands | Strong (`@pvg/editor-core`) |
| Timeline interactions | Move/trim/split/delete/snap/zoom/fit; track flags wired |
| Real preview | Multi-layer real `<video>`/image; CSS effect filters |
| Compositor | Preview compose via `composeAtTime`; **not** full WASM GPU |
| Audio | Volume in schema/commands; mute/solo tracks; waveform UI still simplified |
| Text | Real overlay + inspector |
| Effects | Apply + CSS preview filters; export bake limited |
| Transitions | Schema + commands; preview modulation; export limited |
| Keyframes | Core evaluate + commands; inspector add path exists |
| Export | **Real FFmpeg** primary video-track concat → `renders/*.mp4` |
| Persistence | Phase 3/4 `.pvg` project.json |
| AI | Allowlisted bridge unchanged |

## 15–18. Security / performance

- Export uses `ArgvBuilder` only (no shell).
- Output under project `renders/` via `path_safe`.
- No capability wildcards added.
- Timeline still DOM-based (virtualization deferred).

## 19–20. Tests

| Suite | Result |
|-------|--------|
| `@pvg/editor-core` | **17 passed** |
| `@pvg/desktop` | **38 passed** |
| `pnpm typecheck` | **pass** |
| `pvg-media` cargo check | **pass** |
| Full `pvg-desktop` Tauri GTK link on VPS | **blocked** (missing `gdk-3.0` / gtk sysdeps on this host) |

## 21. Known limitations / remaining gate items

1. Full OpenCut `EditorCore` React tree **not** ported (Next/`@` coupling) — PVG core remains canonical.  
2. Export does **not** yet flatten text overlays / multi-track video / full effects into the MP4.  
3. Real per-clip filmstrip/waveform from Phase 3 derivatives not fully painted on every clip.  
4. Interactive canvas resize/rotate handles incomplete.  
5. Caption SRT import/export deferred.  
6. **Windows NSIS installer not built** (gate: only after editor acceptance; also VPS lacks GTK for full Tauri link + no MSVC cross toolchain verified).  
7. Download button correctly shows **Windows build unavailable** until `artifacts/windows/release.json` exists.

## 22–25. Build artifact

| Item | Status |
|------|--------|
| `artifacts/windows/PVG-AI-Setup-x64.exe` | **ABSENT** |
| `artifacts/windows/release.json` | **ABSENT** |
| SHA-256 | **N/A** |
| Browser download URL | Inactive (`/downloads/windows/…`) |

## 26. Remaining issues (blocker list for READY)

- [ ] End-to-end export UAT on desktop with real MP4 playback  
- [ ] GTK/Tauri native build on VPS or dedicated Windows CI  
- [ ] Cross-compile / package NSIS → publish artifact + SHA-256  
- [ ] Wire derivative thumbnails/waveforms into timeline clips  
- [ ] Richer export filter graph (text/audio mix)  
- [ ] Canvas transform handles + keyframe graph UI polish  

---

## FINAL STATUS

**NOT READY**

Reason: Acceptance gate items 18 (export UAT), 24–26 (Windows build/artifact/download), and several compositor/timeline polish requirements remain incomplete. Automated TypeScript tests pass; installer must not be claimed until built and hashed.

Next: install GTK/Tauri build deps **or** configure Windows CI → run editor UAT → then build `PVG-AI-Setup-x64.exe` → publish `release.json` → enable download link → human Windows UAT.
