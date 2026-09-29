import { useEffect, useState } from "react";
import type { ResolvedLayer } from "@pvg/editor-core";
import { resolveMediaPreviewUrl } from "@/services/mediaPreview";
import { PvgVideoPlayer } from "@/features/editor/media/PvgVideoPlayer";
import type { MediaAsset, PreviewSource, ProjectAssetDto } from "@/types";

function effectsToFilter(effects: ResolvedLayer["effects"]): string | undefined {
  if (!effects?.length) return undefined;
  const parts: string[] = [];
  for (const e of effects) {
    if (!e.enabled) continue;
    const p = e.params ?? {};
    switch (e.type) {
      case "blur":
        parts.push(`blur(${Number(p.radius ?? 4)}px)`);
        break;
      case "brightness_contrast":
        parts.push(`brightness(${Number(p.brightness ?? 1)})`);
        parts.push(`contrast(${Number(p.contrast ?? 1)})`);
        break;
      case "saturation":
        parts.push(`saturate(${Number(p.amount ?? 1)})`);
        break;
      case "grayscale":
        parts.push(`grayscale(${Number(p.amount ?? 1)})`);
        break;
      case "opacity":
        // handled via layer.opacity
        break;
      case "exposure":
        parts.push(`brightness(${1 + Number(p.amount ?? 0)})`);
        break;
      case "vignette":
        // CSS approximation
        parts.push(`contrast(${1 + Number(p.amount ?? 0.1)})`);
        break;
      default:
        break;
    }
  }
  return parts.length ? parts.join(" ") : undefined;
}

export function CompositionLayer(props: {
  layer: ResolvedLayer;
  selected: boolean;
  projectPath: string | null;
  asset: MediaAsset | ProjectAssetDto | null;
  previewSource: PreviewSource;
  playing: boolean;
  onSelect: () => void;
  onDragTransform?: (dx: number, dy: number) => void;
}) {
  const { layer, selected, projectPath, asset, previewSource, playing, onSelect, onDragTransform } =
    props;
  const [url, setUrl] = useState<string | null>(null);
  const [poster, setPoster] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!layer.assetId || !projectPath) {
      setUrl(null);
      return;
    }
    if (layer.kind !== "video" && layer.kind !== "image") return;
    void resolveMediaPreviewUrl({
      projectPath,
      assetId: layer.assetId,
      asset,
      previewSource,
    }).then((res) => {
      if (cancelled) return;
      setUrl(res.url);
      setPoster(res.posterUrl ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [layer.assetId, layer.kind, projectPath, asset, previewSource]);

  const filter = effectsToFilter(layer.effects);
  const flip = `${layer.flipX ? "scaleX(-1) " : ""}${layer.flipY ? "scaleY(-1) " : ""}`;
  const transform = `${flip}translate(calc(-50% + ${layer.x}px), calc(-50% + ${layer.y}px)) scale(${layer.scaleX}, ${layer.scaleY}) rotate(${layer.rotation}deg)`;

  const dragHandlers = {
    onMouseDown: (e: React.MouseEvent) => {
      if (!selected || !onDragTransform) return;
      e.stopPropagation();
      const startX = e.clientX;
      const startY = e.clientY;
      const onUp = (ev: MouseEvent) => {
        window.removeEventListener("mouseup", onUp);
        onDragTransform(ev.clientX - startX, ev.clientY - startY);
      };
      window.addEventListener("mouseup", onUp);
    },
  };

  if (layer.kind === "text" && layer.text) {
    return (
      <div
        className={`canvas-layer text ${selected ? "selected" : ""}`}
        data-testid={`layer-${layer.clipId}`}
        style={{
          opacity: layer.opacity,
          transform,
          color: layer.text.color,
          fontFamily: layer.text.fontFamily,
          fontSize: `${layer.text.fontSize * 0.35}px`,
          fontWeight: layer.text.fontWeight,
          textAlign: layer.text.align,
          letterSpacing: layer.text.letterSpacing,
          filter,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        {...dragHandlers}
      >
        {layer.text.content}
      </div>
    );
  }

  if (layer.kind === "shape" && layer.shape) {
    return (
      <div
        className={`canvas-layer shape ${selected ? "selected" : ""}`}
        data-testid={`layer-${layer.clipId}`}
        style={{
          opacity: layer.opacity,
          width: layer.shape.width * 0.4 * layer.scaleX,
          height: layer.shape.height * 0.4 * layer.scaleY,
          background: layer.shape.kind === "line" ? "transparent" : layer.shape.fill,
          borderRadius: layer.shape.kind === "circle" ? "50%" : layer.shape.cornerRadius,
          border: layer.shape.stroke
            ? `${layer.shape.strokeWidth}px solid ${layer.shape.stroke}`
            : undefined,
          transform,
          filter,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        {...dragHandlers}
      />
    );
  }

  if (layer.kind === "video") {
    return (
      <div
        className={`canvas-layer media-real ${selected ? "selected" : ""}`}
        data-testid={`layer-${layer.clipId}`}
        style={{ opacity: layer.opacity, transform, filter }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        {...dragHandlers}
      >
        {url ? (
          <PvgVideoPlayer
            src={url}
            poster={poster}
            currentTimeSec={Math.max(0, layer.sourceTimeMs / 1000)}
            playing={playing}
            playbackRate={layer.speed || 1}
            muted
            className="program-video"
          />
        ) : (
          <div className="program-fallback">
            <p>Loading…</p>
          </div>
        )}
      </div>
    );
  }

  if (layer.kind === "image") {
    return url ? (
      <img
        src={url}
        alt=""
        data-testid={`layer-${layer.clipId}`}
        className={`program-image canvas-layer ${selected ? "selected" : ""}`}
        style={{ opacity: layer.opacity, transform, filter }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
        }}
        {...dragHandlers}
      />
    ) : null;
  }

  return null;
}
