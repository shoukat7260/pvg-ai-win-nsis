# AI Copilot UI Architecture — Phase 4.1

## Placement

First-class **RightDock** region — never buried under timeline.

Modes:

1. **Inspector** — full right pane inspector  
2. **Split** — inspector top / AI bottom with draggable split (`inspectorSplitPct`)  
3. **AI Copilot** — full right pane AI  

Rail **AI** button and workspace preset **ai** open Copilot. Command palette: Open AI Copilot / Split Inspector / AI.

## Layout (panel)

```
┌─ PVG AI COPILOT ──────── Clear ─┐
│ Project / Sequence / Selection │
│ Suggestion chips               │
│ Chat history (scroll)          │
│ Action cards (Apply / Cancel)  │
├────────────────────────────────┤
│ Ask PVG AI…            [Send]  │  ← pinned (.ed-ai-input)
└────────────────────────────────┘
```

## Behavior

- History scrolls; input always pinned  
- Suggestions trigger existing allowlisted plans  
- Destructive plans require confirm via action card  
- Security: no secrets, shell, credentials, billing in context (Phase 4 pipeline unchanged)

## Resize

Right dock width + split % persisted. Narrow dock still keeps input usable via min heights / flex.

## Functional boundary

UI-only changes in 4.1. Command execution remains `@pvg/editor-core` allowlist + `AiCopilotPanel` local/provider path.
