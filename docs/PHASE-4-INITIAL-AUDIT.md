# PHASE 4 — Initial Audit

**Product:** PVG AI  
**Phase:** 4 — Professional editor core + enterprise desktop UI + timeline + canvas + keyframes + AI Editor Copilot  
**Date:** 2026-09-29  
**Status:** READY FOR USER ACCEPTANCE (implementation complete; awaiting manual UAT)

## Approved baseline

| Phase | Status |
|-------|--------|
| 1 | APPROVED |
| 2 | APPROVED |
| 3 | APPROVED |

## Phase 3 assets to extend (no second system)

| Asset | Location | Phase 4 action |
|-------|----------|----------------|
| Sequence / Track / Clip schema | `packages/project-format` v2 | Bump to **v3**; extend fields |
| Migration registry | `packages/project-format/src/migrate.ts` | Add v2→v3 |
| Timecode helpers | `packages/project-format/src/timecode.ts` | Reuse |
| Media workspace | `apps/desktop/src/features/media/*` | Lift into editor panels |
| Media store / jobs / proxies | Phase 3 desktop + Rust | Reuse |
| Project save/load IPC | `project_cmd.rs` | Load full document into editor |
| Auth / vault / providers | Phase 2 | AI Copilot uses provider metadata only |

## Gaps (must build)

- No timeline / Edit UI (nav stub “Coming later”)
- No command/history stack
- No canvas compositor / program monitor
- No keyframe engine / graph
- No AI Editor Copilot with allowlisted tools
- Rust `Sequence.tracks` still `Vec<Value>` (TS schema is canonical; typed Rust optional)

## Defects found (fix, do not rewrite unrelated)

1. Docs still mention sequence-level `clips[]` — **code uses `tracks[].clips`**. Treat Zod as canonical; update docs in Phase 4.
2. `projectService.open` unused by UI — editor must open full `ProjectDocument`.
3. Desktop does not depend on `@pvg/project-format` yet — wire it.

## Non-goals (Phase 4)

- Full AI video generation (Phase 5)
- Voice/dubbing (Phase 6)
- Advanced VFX/color suite (Phase 7)
- Competitor UI clones
- Fake buttons / fake AI replies

## Security constraints

- AI tools: allowlist only → same command pipeline as UI
- No secrets in AI context / DOM / clipboard
- Phase 1–3 security regressions must continue to pass
