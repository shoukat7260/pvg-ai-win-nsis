# PHASE 4.1 — Test Report

## Automated

| Suite | Result |
|-------|--------|
| `@pvg/desktop` typecheck | PASS |
| `phase4-editor.test.tsx` | PASS |
| `phase41-layout.test.tsx` | PASS (dock modes, rail icons, layout reset) |

## Functional regression (Phase 4)

Editing model, commands, AI allowlist, project format v3 — **not rewritten**. UI wiring preserved through store dispatch.

## Security regression

AI still blocks secret/shell prompts client-side; commands allowlisted. No credential UI in Copilot.

## Visual / responsive

Manual UAT required (`PHASE-4.1-USER-ACCEPTANCE.md`). Automated screenshot pack deferred (no Playwright visual suite in repo yet).

## Performance (spot)

| Interaction | Observation |
|-------------|-------------|
| Editor load | Same document open path |
| Panel resize | CSS width/height only |
| Selection | Existing store updates |
| AI open | Mount dock pane only |

No intentional expensive filters on timeline clips.

## Known test gaps

- Pixel visual regression screenshots not automated  
- Full Phase 1–3 suite should be run in CI/local before release sign-off  
