#!/usr/bin/env bash
# Generate deterministic Phase 4.3D real-media fixtures under fixtures/real-media/
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/fixtures/real-media"
mkdir -p "$OUT"
FFMPEG="${FFMPEG:-ffmpeg}"

"$FFMPEG" -y -f lavfi -i color=c=blue:s=1280x720:d=5 -f lavfi -i sine=f=440:d=5 \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$OUT/landscape-5s.mp4"
"$FFMPEG" -y -f lavfi -i color=c=green:s=720x1280:d=5 -f lavfi -i sine=f=880:d=5 \
  -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$OUT/portrait-5s.mp4"
"$FFMPEG" -y -f lavfi -i color=c=red:s=640x360:d=5 \
  -c:v libx264 -pix_fmt yuv420p -an "$OUT/video-no-audio-5s.mp4"
"$FFMPEG" -y -f lavfi -i color=c=yellow:s=800x600:d=1 -frames:v 1 -update 1 "$OUT/image.jpg"
"$FFMPEG" -y -f lavfi -i color=c=0xFF00FF@0.5:s=256x256:d=1 -frames:v 1 -update 1 "$OUT/transparent.png"
"$FFMPEG" -y -f lavfi -i sine=f=220:d=5 -c:a pcm_s16le "$OUT/tone.wav"
"$FFMPEG" -y -f lavfi -i sine=f=330:d=5 -c:a libmp3lame "$OUT/tone.mp3"
cp -f "$OUT/landscape-5s.mp4" "$OUT/video-with-audio-5s.mp4"
echo "Fixtures written to $OUT"
ls -la "$OUT"
