# PHASE 4 — Performance Report

**Measured environment (dev):** Linux 6.8 · browser/jsdom test runner + local Vite preview  
**Date:** 2026-09-29

## Automated
| Suite | Result | Notes |
|-------|--------|-------|
| `@pvg/editor-core` | 15/15 pass | Timeline/keyframe/AI ops |
| `@pvg/project-format` | 20/20 pass | v3 migrate/validate |
| `@pvg/desktop` | 26/26 pass | Includes phase4-editor UI |

## Interaction notes (qualitative)
- Clip drag commits **one** command on mouse-up (no per-mousemove serialization)
- Autosave debounced ~2.5s after dirty command
- Timeline uses absolute-positioned clips (virtualization recommended when >500 clips — foundation OK for Phase 4 fixtures)
- `composeAtTime` is O(tracks×clips) per frame — acceptable for Phase 4 fixture sizes

## Not claimed
- No hard FPS guarantee on 4K multi-track timelines
- GPU/WebGPU compositor not required for Phase 4 preview

## Hardware note
Record machine-specific scrubbing FPS during manual UAT on target Windows workstation when available.
