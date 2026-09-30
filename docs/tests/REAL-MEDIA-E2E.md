# Real-media E2E (Phase 4.3D)

**Fixtures:** `fixtures/real-media/`  
**Generator:** `scripts/generate-real-media-fixtures.sh`

## Fixture inventory

| File | Purpose |
|------|---------|
| `landscape-5s.mp4` | 1280×720 video + audio |
| `portrait-5s.mp4` | 720×1280 video + audio |
| `video-with-audio-5s.mp4` | Alias of landscape |
| `video-no-audio-5s.mp4` | Video without audio |
| `image.jpg` | Still image |
| `transparent.png` | Semi-transparent PNG |
| `tone.wav` | WAV audio |
| `tone.mp3` | MP3 audio |

## Workflow under test

```
Create project JSON (in-memory / temp dir)
→ stage fixtures as project media assets
→ V1: landscape video
→ V2: portrait overlay (scaled)
→ image clip
→ text clip
→ A1: WAV
→ effect (grayscale / brightness)
→ transition (fade)
→ keyframes (opacity + x)
→ export_sequence_mp4
→ ffprobe validate streams / duration / resolution
→ optional frame extract for keyframe motion
```

Automated coverage: `pvg-media` test `real_media_e2e_multi_layer_export`.

## Validation checks (not exit-code only)

1. Output file exists under `{project}/renders/`
2. Duration ≈ sequence duration (±10%)
3. Resolution matches preset/sequence
4. Video stream present
5. Audio stream present when audio layers exported
6. `video_layers` / `text_layers` / `audio_layers` > 0 as expected
7. Continuous keyframe expand ⇒ many video segments when animated

## Preview / export parity

Preview uses `composeAtTime` + shared TS evaluator.  
Export uses the same property paths and easing (`linear` / `easeIn` / `easeOut` / `hold`) via Rust `evaluate_keyframes`, sampled **per frame**.

## Manual UI path (Windows UAT)

See `docs/PHASE-4.3-WINDOWS-UAT.md` — human runs import → timeline → save → reopen → export → play outside PVG AI.
