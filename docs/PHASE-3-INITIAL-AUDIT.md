# PHASE 3 — Initial Repository Audit

**Date:** 2026-09-29  
**Status:** COMPLETE  
**Phase 1:** APPROVED  
**Phase 2:** APPROVED (user-accepted)

---

## 1. Repository state

| Item | Finding |
|------|---------|
| Branch | `main` (worktree; commits not yet established as remote history) |
| Desktop | Tauri v2 + React/TS; auth shell from Phase 2 |
| Native crates | `pvg-core` (paths/projects), `pvg-vault` (secrets) |
| Project format | `@pvg/project-format` schema **v1** |
| Media pipeline | **Absent** (dirs only: assets/proxies/thumbnails/…) |
| FFmpeg | Not integrated |
| Preview / jobs | Progress event stub only |

---

## 2. What Phase 1/2 provide (reuse)

| Area | Reuse |
|------|--------|
| Path validation / symlink escape tests | `pvg-core` — extend for import source roots |
| Narrow Tauri IPC + capabilities | Add typed media commands only |
| Vault / auth / sessions | Unchanged; never serialize secrets into projects |
| `@pvg/project-format` validate/load/save/migrate | Bump schema; add migration v1→v2 |
| Bundle directory layout | Extend with `media/`, `waveforms/`, job metadata |
| Desktop AppShell / settings / auth | Add Media workspace; keep Phase 2 settings |
| Progress channel `pvg://progress` | Expand to real job events |

---

## 3. Critical gap: TS ↔ Rust project schema

TypeScript document includes `assets`, `timeline` stub, `settings`.  
Rust `ProjectDocument` currently stores a **subset** (id/name/workspace/tags).

**Decision:** Unify on `@pvg/project-format` JSON as the **canonical portable project document**. Rust load/save must round-trip the full JSON (validate via shared schema rules / serde Value + integrity checks). Local indexes (asset catalog, jobs) may live beside the bundle as disposable/cache metadata — never a second competing source of truth for project structure.

---

## 4. Phase 3 needs

| Capability | Status |
|------------|--------|
| Media domain types | New |
| Import (picker / DnD / multi) | New IPC + UI |
| Probe (ffprobe) | New `pvg-media` |
| Thumbnail / waveform / proxy | New |
| Job queue + cancel | New |
| Preview (source monitor) | New |
| Media browser + bins + search | New |
| Missing media / relink | New |
| Autosave / crash recovery / lock | Extend project lifecycle |
| Sequence foundation (persistable stub+) | Schema v2 |
| Storage / cache / disk warnings | New |
| User-scoped local roots | Bind workspace under authenticated user id |

---

## 5. Architecture decisions

1. **Local-first:** no automatic cloud upload of media.
2. **Source policy default: LINK** — project stores absolute path + fingerprint; optional **COPY** into `media/imported/` when user chooses.
3. **Derivatives** under project: `thumbnails/`, `waveforms/`, `proxies/`, `cache/` — disposable.
4. **FFmpeg:** argument arrays only; discover via `PVG_FFMPEG_PATH` / `PATH`; never shell-string interpolation.
5. **Time:** rational frame/timebase utilities in TS (+ Rust helpers); avoid float-only identity.
6. **Preview:** HTML `<video>` / `<audio>` / `<img>` for Phase 3 using file URLs via Tauri asset protocol / converted paths; architecture ready for future sequence compositor.
7. **Jobs:** Rust-side worker pool with cooperative cancel; UI Job Center.

---

## 6. Assumptions

- FFmpeg/ffprobe available in CI optionally; tests use fixtures + mock probe when binary missing.
- Phase 2 auth remains required for desktop shell; local projects scoped under `users/<userId>/`.
- Full timeline editor is Phase 4 — only sequence data model + empty/basic sequence persistence here.
- Live hardware encode (NVENC/QSV/AMF) is foundation/detection only.

---

## 7. Deferred

- Professional multi-track editing, effects, color, VFX
- AI generation / ElevenLabs / dubbing
- Cloud media sync
- Full sequence compositor / WebCodecs pipeline
- Signed Windows installer validation in this environment

---

## 8. Security non-negotiables

- Preserve Phase 1/2 regression suites
- No arbitrary shell / unrestricted FS
- No provider secrets in project/diagnostics
- Path escape rejection for cache/asset IDs
- Untrusted media; no execute-on-import
