# Playback Synchronization — Phase 4.2

## Canonical clock

`editorStore.playback.currentTimeMs` is the single source of truth.

| Consumer | Behavior |
|----------|----------|
| Timeline playhead | `left = currentTimeMs * pxPerMs` |
| Program monitor | seeks video to `layer.sourceTimeMs / 1000` |
| Status / top bar | formatTimecode(currentTimeMs, fps) |
| AI context | playhead time in allowlisted plans |

## Play

While `playback.playing`, Program monitor rAF loop advances the store clock by `dt * rate`. Video element play is also requested; seek keeps source time aligned when scrubbing.

## Frame step

`±1000 / frameRate` ms on project FPS.

## Focus rule

When AI/input focused, keyboard Space does not toggle play (EditorKeyboardLayer typing guard).
