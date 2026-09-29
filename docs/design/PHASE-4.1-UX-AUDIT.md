# PHASE 4.1 — UX Audit (screenshot → change)

| Screenshot issue | Change | Reason | Result |
|------------------|--------|--------|--------|
| AI Copilot buried under inspector | `RightDock` with Inspector / Split / AI + vertical split % | Copilot is first-class | Input always reachable in split/AI modes |
| Letter rail M/P/T | SVG icons + aria-labels + expand labels | Professional tool discovery | Recognizable tools with tooltips |
| Weak Save / flat top chrome | Compact top bar: brand, breadcrumb, workspace tabs, icon actions | Hierarchy | Save primary but not dominant |
| Sparse inspector empty state | Sequence summary (res, fps, duration, tracks) | Useful no-selection state | No “Select a clip…” dead end |
| Huge media drop zone | Compact import when assets exist | Library dominates | Import remains available |
| Giant Text/Shapes buttons | Creation grid cards | Density | Compact library feel |
| History SaaS cards | Dense history list | Professional density | Scannable session history |
| Weak mode tabs | Segmented workspace switch; disabled audio/color with tooltip | Clear future modes | No broken-looking buttons |
| Low contrast muted text | Tokenized `--pvg-text-*` with readable muted | Accessibility | Stronger hierarchy |
| Primitive timeline chrome | Grouped transport / snap / zoom; type-tint clips | NLE readability | Clearer editing surface |
| Command palette basic | Dock commands for AI/Inspector/Reset layout | Discoverability | Layout control via Ctrl+K |
| Settings light SaaS | Deferred (editor-first) | Phase scope | Tokens reusable later |

## Validation methods

- Automated: `phase4-editor.test.tsx`, `phase41-layout.test.tsx`  
- Manual: `docs/PHASE-4.1-USER-ACCEPTANCE.md` (P4.1-A … P4.1-Y)
