import type { Clip, Sequence } from "@pvg/project-format";
import { evaluateTransformProperty } from "./keyframes/evaluate.js";

export interface ResolvedLayer {
  clipId: string;
  trackId: string;
  trackType: string;
  kind: Clip["kind"];
  assetId: string | null;
  localTimeMs: number;
  opacity: number;
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
  flipX: boolean;
  flipY: boolean;
  blendMode: Clip["blendMode"];
  text: Clip["text"];
  shape: Clip["shape"];
  effects: Clip["effects"];
  transitionIn: Clip["transitionIn"];
  transitionOut: Clip["transitionOut"];
  volume: number;
  reverse: boolean;
  speed: number;
  sourceTimeMs: number;
  zIndex: number;
}

/**
 * Evaluate active layers at a timeline time for sequence preview.
 * Does not flatten to an intermediate video — pure composition graph.
 */
export function composeAtTime(
  sequence: Sequence,
  timeMs: number,
): ResolvedLayer[] {
  const layers: ResolvedLayer[] = [];
  let z = 0;
  // Bottom track first → top last (video tracks typically reverse visual order)
  const tracks = [...sequence.tracks];
  for (let ti = tracks.length - 1; ti >= 0; ti--) {
    const track = tracks[ti]!;
    if (!track.enabled || !track.visible) continue;
    if (track.type === "audio" && track.muted) continue;
    // Solo: if any audio track is soloed, mute non-solo audio
    if (track.type === "audio") {
      const anySolo = sequence.tracks.some((t) => t.type === "audio" && t.solo);
      if (anySolo && !track.solo) continue;
    }

    for (const clip of track.clips) {
      if (!clip.enabled) continue;
      const end = clip.timelineEndMs ?? clip.timelineStartMs;
      if (timeMs < clip.timelineStartMs || timeMs >= end) continue;

      const localTimeMs = timeMs - clip.timelineStartMs;
      const t = clip.transform;
      const opacity = evaluateTransformProperty(
        t.opacity,
        clip.keyframes["transform.opacity"],
        localTimeMs,
      );
      const x = evaluateTransformProperty(
        t.x,
        clip.keyframes["transform.x"],
        localTimeMs,
      );
      const y = evaluateTransformProperty(
        t.y,
        clip.keyframes["transform.y"],
        localTimeMs,
      );
      const scaleX = evaluateTransformProperty(
        t.scaleX,
        clip.keyframes["transform.scaleX"],
        localTimeMs,
      );
      const scaleY = evaluateTransformProperty(
        t.scaleY,
        clip.keyframes["transform.scaleY"],
        localTimeMs,
      );
      const rotation = evaluateTransformProperty(
        t.rotation,
        clip.keyframes["transform.rotation"],
        localTimeMs,
      );

      let sourceTimeMs =
        clip.sourceInMs + localTimeMs * (clip.speed || 1);
      if (clip.reverse) {
        const srcOut = clip.sourceOutMs ?? clip.sourceInMs;
        sourceTimeMs = srcOut - localTimeMs * (clip.speed || 1);
      }

      // Transition opacity modulation
      let transOpacity = 1;
      if (clip.transitionIn && localTimeMs < clip.transitionIn.durationMs) {
        const p = localTimeMs / clip.transitionIn.durationMs;
        if (
          clip.transitionIn.type === "fade" ||
          clip.transitionIn.type === "dissolve"
        ) {
          transOpacity *= p;
        }
      }
      if (clip.transitionOut) {
        const remaining = end - timeMs;
        if (remaining < clip.transitionOut.durationMs) {
          const p = remaining / clip.transitionOut.durationMs;
          if (
            clip.transitionOut.type === "fade" ||
            clip.transitionOut.type === "dissolve"
          ) {
            transOpacity *= p;
          }
        }
      }

      layers.push({
        clipId: clip.id,
        trackId: track.id,
        trackType: track.type,
        kind: clip.kind,
        assetId: clip.assetId,
        localTimeMs,
        opacity: opacity * transOpacity,
        x,
        y,
        scaleX,
        scaleY,
        rotation,
        flipX: t.flipX,
        flipY: t.flipY,
        blendMode: clip.blendMode,
        text: clip.text,
        shape: clip.shape,
        effects: clip.effects.filter((e) => e.enabled),
        transitionIn: clip.transitionIn,
        transitionOut: clip.transitionOut,
        volume: track.muted ? 0 : clip.volume,
        reverse: clip.reverse,
        speed: clip.speed,
        sourceTimeMs,
        zIndex: z++,
      });
    }
  }
  return layers;
}
