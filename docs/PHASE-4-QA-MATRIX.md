# PHASE 4 — QA Matrix

| Category | Coverage | Automated | Manual UAT |
|----------|----------|-----------|------------|
| UI shell | Editor chrome, rail, panels | phase4-editor.test | P4-A/B/C |
| Timeline | move/trim/split/delete/ripple/roll | editor-core | P4-D/E |
| Canvas | layers, transform sync | composeAtTime + UI | P4-F |
| Text | create + style fields | UI | P4-F |
| Animation | keyframes + presets | editor-core | P4-G |
| Effects / transitions | dissolve/fade/blur stack | commands + inspector | UAT |
| Preview | composeAtTime program view | unit | UAT |
| AI Copilot | plans, confirm, undo | editor-core + UI | P4-H/I |
| Persistence | save/load v3 | project-format + IPC | P4-K |
| Security | AI deny list, Phase 1–3 | AI unit + prior suites | P4-I |
| Performance | 15+ unit ops; large timeline manual | — | large project UAT |
| Accessibility | focus-aware shortcuts | manual | P4-M |

## Known gaps
- Full visual regression screenshot baseline not yet in CI
- Slip/slide UI deferred
- Free-form LLM provider path is guidance-only until structured response adapter lands
