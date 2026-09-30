# Phase 4.3D — Final Report

**Version:** 0.1.3  
**Date:** 2026-09-30  

**STATUS:** **READY FOR USER ACCEPTANCE** (editor / NLE engineering)  
**WINDOWS BUILD / DOWNLOAD:** **PENDING**  
**WINDOWS MANUAL UAT:** **PENDING**

Do **not** mark COMPLETE / APPROVED / RELEASED until human Windows UAT passes.

---

## Keyframe closure

| Item | Result |
|------|--------|
| Mid-clip bake removed | Yes |
| Per-frame continuous evaluation | Yes — expand animated clips at sequence `frameRate` |
| Properties | x, y, scaleX, scaleY, rotation, opacity, volume (when keyframed) |
| Easing | linear, easeIn, easeOut, hold (+ bezier y-approx) |
| Shared semantics | Same property paths as `composeAtTime` / TS `evaluateKeyframes` |
| Filter graph size | `-filter_complex_script` when graph > 6k chars |
| Input dedupe | Unique `-i` paths shared across segments |

Evidence: `export::tests::{evaluate_keyframes_*, continuous_keyframe_x_motion_export_and_frame_probe, keyframe_speed_flip_export_still_works}`

---

## Real-media E2E

| Item | Result |
|------|--------|
| Fixtures | `fixtures/real-media/*` via `scripts/generate-real-media-fixtures.sh` |
| Doc | `docs/tests/REAL-MEDIA-E2E.md` |
| Automated | `real_media_e2e_multi_layer_export` — V1+V2+image+text+audio+effect+transition+keyframes → MP4 |
| Validation | file exists, duration, 1280×720, video+audio streams (ffprobe) |

---

## Preview / export parity

- Preview: `composeAtTime` + TS evaluator (+ volume keyframes).  
- Export: Rust `evaluate_keyframes` / `transform_at` / transition opacity mod, **per frame**.  
- Supported transitions: fade / dissolve / dip; wipe/slide unavailable.

---

## NLE / project / auth regression

| Suite | Result |
|-------|--------|
| Phase 4.3 / 4.3B / 4.3C vitest (21) | PASS |
| editor-core (17) | PASS |
| pvg-core (22) | PASS |
| pvg-media export (6) | PASS |
| Desktop typecheck | PASS |

---

## NLE matrix (critical)

| Feature | Status |
|---------|--------|
| Continuous keyframe export | **PASS** |
| Program audio | PASS (4.3C) |
| Multi-layer export | PASS |
| Timeline ops | PASS |
| Wipe/slide | UNSUPPORTED |
| OpenCut WASM | **DEFERRED** (non-blocking) |
| Custom NSIS multi-slide | **PARTIAL / DEFERRED** |

---

## Installer storytelling

Stock Tauri 2 NSIS does not host CapCut-style multi-slide pages without a custom template.

**INSTALLER STORYTELLING: PARTIAL / DEFERRED** — keep stable functional installer; SVG assets remain in `branding/installer-slides/`.

---

## Windows artifact

| Field | Value |
|-------|--------|
| Target | `PVG-AI-Setup-x64.exe` |
| Version | 0.1.3 (bumped in app package / tauri.conf / Cargo.toml) |
| Code on GitHub | `origin/release/0.1.3` |
| Workflow YAML on GitHub | **MISSING** — push of `.github/workflows/*` rejected (OAuth App lacks `workflow` scope) |
| Local `artifacts/windows/` | Still **0.1.1** prior build — **do not ship as 0.1.3** |
| release.json / SHA-256 for 0.1.3 | **PENDING** |
| Browser `/downloads/windows/` | **PENDING** |

**Unblock:** re-authenticate `gh` with `workflow` scope (or add `windows-release.yml` via GitHub UI), push workflow to the repo, run `workflow_dispatch` on `release/0.1.3`, then stage artifact + update download endpoints.

---

## Known limitations

1. Custom NSIS storytelling deferred.  
2. OpenCut WASM deferred.  
3. Export samples keyframes at sequence fps (preview clock granularity).  
4. Human Windows UAT not performed.  
5. 0.1.3 installer / browser download not published yet.

---

## Final status

**STATUS: READY FOR USER ACCEPTANCE** (engineering NLE / export gates)

**WINDOWS MANUAL UAT: PENDING**

Checklist: `docs/PHASE-4.3-WINDOWS-UAT.md`
