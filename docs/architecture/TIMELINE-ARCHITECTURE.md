# Timeline Architecture

```
Sequence → Tracks[] → Clips[] → (transform, keyframes, effects, transitions)
```

- Canonical types: `@pvg/project-format` v3 (`Sequence`, `Track`, `Clip`)
- Mutations: `@pvg/editor-core` commands → `HistoryStack` → project document
- Frame accuracy: ms + sequence `frameRate` (Phase 3 timecode helpers)
- Non-destructive: clips reference `assetId`; sources untouched
- Linked A/V via `linkedClipId`; groups via `groupId`
- Ripple/roll/split/trim implemented in `packages/editor-core/src/timeline/*`

**Deferred:** full slip/slide UX, magnetic timeline, compound nest UI
