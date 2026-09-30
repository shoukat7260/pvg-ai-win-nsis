import { useEffect, useMemo, useState } from "react";
import type { ResolvedLayer } from "@pvg/editor-core";
import { resolveMediaPreviewUrl } from "@/services/mediaPreview";
import { PvgVideoPlayer } from "@/features/editor/media/PvgVideoPlayer";
import type { MediaAsset, PreviewSource, ProjectAssetDto } from "@/types";

/**
 * Hidden audio bus for program monitor.
 * Plays audio-track / audio-kind layers driven by the editor clock.
 * Video layers keep their own mute state in CompositionLayer (deduped).
 */
export function ProgramAudioBus(props: {
  layers: ResolvedLayer[];
  projectPath: string | null;
  assetLookup: (assetId: string) => MediaAsset | ProjectAssetDto | null;
  previewSource: PreviewSource;
  playing: boolean;
}) {
  const { layers, projectPath, assetLookup, previewSource, playing } = props;

  const audioLayers = useMemo(
    () =>
      layers.filter(
        (l) =>
          (l.trackType === "audio" || l.kind === "audio") &&
          l.assetId &&
          l.volume > 0,
      ),
    [layers],
  );

  if (!projectPath || audioLayers.length === 0) return null;

  return (
    <div className="program-audio-bus" aria-hidden data-testid="program-audio-bus">
      {audioLayers.map((layer) => (
        <AudioLayerPlayer
          key={layer.clipId}
          layer={layer}
          projectPath={projectPath}
          asset={assetLookup(layer.assetId!)}
          previewSource={previewSource}
          playing={playing}
        />
      ))}
    </div>
  );
}

function AudioLayerPlayer(props: {
  layer: ResolvedLayer;
  projectPath: string;
  asset: MediaAsset | ProjectAssetDto | null;
  previewSource: PreviewSource;
  playing: boolean;
}) {
  const { layer, projectPath, asset, previewSource, playing } = props;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!layer.assetId) {
      setUrl(null);
      return;
    }
    void resolveMediaPreviewUrl({
      projectPath,
      assetId: layer.assetId,
      asset,
      previewSource,
    }).then((res) => {
      if (!cancelled) setUrl(res.url);
    });
    return () => {
      cancelled = true;
    };
  }, [layer.assetId, projectPath, asset, previewSource]);

  if (!url) return null;

  return (
    <PvgVideoPlayer
      src={url}
      currentTimeSec={Math.max(0, layer.sourceTimeMs / 1000)}
      playing={playing}
      playbackRate={layer.speed || 1}
      muted={false}
      volume={Math.min(1, Math.max(0, layer.volume))}
      className="program-audio-el"
    />
  );
}
