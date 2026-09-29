# PHASE 4 — Test Report

**Date:** 2026-09-29

## Automated results

| Package | Tests | Status |
|---------|-------|--------|
| `@pvg/project-format` | 20 | PASS |
| `@pvg/editor-core` | 15 | PASS |
| `@pvg/desktop` | 26 | PASS |

### Editor-core coverage highlights
- Move/undo/redo
- Split (unique IDs, shared asset)
- Trim
- Ripple delete A|B|C → A|C
- Roll preserves duration
- Speed 2x + undo
- Keyframe interpolation + composeAtTime opacity
- AI valid tool / forbidden tools / invalid schema / 2x local plan + undo

### Desktop
- Editor workspace chrome render
- Empty state without project
- Navigation: Edit enabled; Create/AI still “Coming later”

## Security regression
- AI forbidden tools rejected (`shell`, `get_api_key`, etc.)
- Phase 1–3 desktop/auth/media suites still pass in this run

## Manual
See `PHASE-4-USER-ACCEPTANCE.md` — **pending user execution**.
