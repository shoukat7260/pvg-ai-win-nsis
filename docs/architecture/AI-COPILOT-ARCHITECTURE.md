# AI Copilot Architecture

```
User text → safety filter → tryLocalEditPlan / (future provider structured plan)
         → AiPlan schema validate → user confirm → planToCommands → HistoryStack
```

## Allowlisted tools
`select_clip`, `split_clip`, `delete_clip`, `ripple_delete_clip`, `move_clip`, `trim_clip`, `set_speed`, `set_opacity`, `set_transform`, `add_text`, `add_transition`, `add_marker`, `duplicate_clip`, `add_fade`

## Forbidden
shell, eval, filesystem, secrets/API keys, Phase 5/6 generate_* tools

## Context (safe)
project/sequence names, selected clip ids/types/durations/speeds, playhead, track summary — **never** paths, tokens, vault contents

## Persistence
Chat is session-local by default (clearable). Applied edits become normal project commands only.

## Providers
Reuse Phase 2 connection metadata. If none connected, show connect guidance; do not fake LLM replies.
