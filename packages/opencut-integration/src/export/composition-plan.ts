/**
 * Build a declarative export composition plan from a sequence (mirrors Rust exporter).
 * Used for tests and AI/command preview — does not invoke FFmpeg.
 */
import type { ProjectDocument, Sequence } from "@pvg/project-format";

export type ExportCompositionPlan = {
  durationMs: number;
  width: number;
  height: number;
  videoLayers: Array<{
    clipId: string;
    assetId: string | null;
    kind: string;
    startMs: number;
    endMs: number;
    effects: string[];
  }>;
  textLayers: Array<{
    clipId: string;
    content: string;
    startMs: number;
    endMs: number;
  }>;
  audioLayers: Array<{
    clipId: string;
    assetId: string | null;
    startMs: number;
    endMs: number;
    volume: number;
  }>;
};

export function buildExportCompositionPlan(
  project: ProjectDocument,
  sequenceId: string,
): ExportCompositionPlan {
  const seq =
    project.sequences.find((s) => s.id === sequenceId) ?? project.sequences[0];
  if (!seq) {
    throw new Error("SEQUENCE_NOT_FOUND");
  }
  return planFromSequence(seq);
}

function planFromSequence(seq: Sequence): ExportCompositionPlan {
  const videoLayers: ExportCompositionPlan["videoLayers"] = [];
  const textLayers: ExportCompositionPlan["textLayers"] = [];
  const audioLayers: ExportCompositionPlan["audioLayers"] = [];

  for (const track of [...seq.tracks].reverse()) {
    if (!track.enabled) continue;
    for (const clip of track.clips) {
      if (!clip.enabled) continue;
      const end = clip.timelineEndMs ?? clip.timelineStartMs;
      if (track.type === "audio" || clip.kind === "audio") {
        if (track.muted) continue;
        audioLayers.push({
          clipId: clip.id,
          assetId: clip.assetId,
          startMs: clip.timelineStartMs,
          endMs: end,
          volume: clip.volume,
        });
        continue;
      }
      if (!track.visible) continue;
      if (clip.kind === "text") {
        textLayers.push({
          clipId: clip.id,
          content: clip.text?.content ?? "",
          startMs: clip.timelineStartMs,
          endMs: end,
        });
        continue;
      }
      if (clip.kind === "video" || clip.kind === "image") {
        videoLayers.push({
          clipId: clip.id,
          assetId: clip.assetId,
          kind: clip.kind,
          startMs: clip.timelineStartMs,
          endMs: end,
          effects: clip.effects.filter((e) => e.enabled).map((e) => e.type),
        });
        if (clip.kind === "video" && !track.muted && clip.volume > 0) {
          audioLayers.push({
            clipId: clip.id,
            assetId: clip.assetId,
            startMs: clip.timelineStartMs,
            endMs: end,
            volume: clip.volume,
          });
        }
      }
    }
  }

  return {
    durationMs: seq.durationMs,
    width: seq.width,
    height: seq.height,
    videoLayers,
    textLayers,
    audioLayers,
  };
}
