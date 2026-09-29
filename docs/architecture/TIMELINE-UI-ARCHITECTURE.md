# Timeline UI Architecture — Phase 4.2

## Structure

```
timeline-root
├── timeline-toolbar (Playback | Edit/Snap | Zoom)
├── timeline-scroll
│   └── timeline-canvas
│       ├── timeline-ruler + playhead + markers
│       └── timeline-tracks
│           ├── track-header (name, type pill, M/S/V/L)
│           └── track-lane → tl-clip (kind styles, trim handles, label)
```

## Data vs chrome

Canonical sequence model remains `@pvg/project-format` / editor-core commands.

UI derives clip geometry from `timelineStartMs` / `timelineEndMs` × zoom (`pxPerMs`).

## Visual upgrades (4.2)

- Type-tinted clips (video strip pattern, audio waveform-like band, text amber)
- Compact track type pills (V/A/T/O)
- Grouped transport / snap / zoom toolbar
- Adaptive ruler mark density from zoom
- Selected clip accent border

## Deferred / foundation

- Live thumbnail filmstrips from Phase 3 JPEG derivatives
- Accurate waveform peaks from cache
- Keyframe diamond lanes under expanded clips
- Follow-playhead auto-scroll preference UI
