import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import type { MediaAsset, PreviewSource } from "@/types";
import { formatDuration } from "./mediaUi";
import { resolveMediaPreviewUrl } from "@/services/mediaPreview";
import { useAppStore } from "@/state/appStore";

interface SourcePreviewProps {
  asset: MediaAsset | null;
  previewSource: PreviewSource;
  onPreviewSourceChange: (source: PreviewSource) => void;
}

export function SourcePreview({
  asset,
  previewSource,
  onPreviewSourceChange,
}: SourcePreviewProps) {
  const projectPath = useAppStore((s) => s.currentProject?.path ?? null);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);

  const isImage = asset?.kind === "image";
  const isAudio = asset?.kind === "audio";

  useEffect(() => {
    let cancelled = false;
    setPlaying(false);
    setCurrentMs(0);
    setDurationMs(asset?.durationMs ?? 0);
    setMediaError(null);
    setSrc(null);
    if (!asset || !projectPath) return;
    void resolveMediaPreviewUrl({
      projectPath,
      assetId: asset.id,
      asset,
      previewSource,
    }).then((res) => {
      if (cancelled) return;
      setSrc(res.url);
      if (!res.url) setMediaError(res.reason ?? "Preview unavailable");
    });
    return () => {
      cancelled = true;
    };
  }, [asset, asset?.id, previewSource, projectPath, asset?.durationMs]);

  const togglePlay = useCallback(() => {
    const el = mediaRef.current;
    if (!el) return;
    if (el.paused) {
      void el
        .play()
        .then(() => setPlaying(true))
        .catch(() => {
          setMediaError("Playback unavailable in this environment");
          setPlaying(false);
        });
    } else {
      el.pause();
      setPlaying(false);
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") {
        return;
      }
      if (!asset || isImage) return;
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [asset, isImage, togglePlay]);

  useEffect(() => {
    const el = mediaRef.current;
    if (!el) return;
    el.muted = muted;
    el.volume = volume;
  }, [muted, volume, asset?.id]);

  if (!asset) {
    return (
      <div
        className="flex h-full min-h-[220px] items-center justify-center rounded-surface border border-dashed border-white/10 bg-charcoal-900/50"
        data-testid="source-preview-empty"
      >
        <p className="text-sm text-charcoal-400">Select media to preview</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3" data-testid="source-preview">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate font-display text-sm font-semibold text-charcoal-100">
          {asset.name}
        </p>
        <div className="flex rounded-xl border border-white/10 p-0.5" data-testid="preview-source-selector">
          {(["auto", "proxy", "original"] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onPreviewSourceChange(opt)}
              className={`rounded-lg px-2.5 py-1 text-[11px] capitalize transition ${
                previewSource === opt
                  ? "bg-accent-mute text-accent-bright"
                  : "text-charcoal-400 hover:text-charcoal-100"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="relative flex min-h-[200px] flex-1 items-center justify-center overflow-hidden rounded-surface border border-white/[0.06] bg-black/50">
        {isImage ? (
          <img
            src={src ?? undefined}
            alt={asset.name}
            className="max-h-[320px] max-w-full object-contain"
            onError={() => setMediaError("Preview image unavailable")}
          />
        ) : isAudio ? (
          <audio
            ref={(el) => {
              mediaRef.current = el;
            }}
            src={src ?? undefined}
            className="w-full px-4"
            onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
            onLoadedMetadata={(e) =>
              setDurationMs(e.currentTarget.duration * 1000 || asset.durationMs || 0)
            }
            onEnded={() => setPlaying(false)}
            onError={() => setMediaError("Audio preview unavailable")}
          />
        ) : (
          <video
            ref={(el) => {
              mediaRef.current = el;
            }}
            src={src ?? undefined}
            className="max-h-[320px] max-w-full"
            playsInline
            data-testid="source-video"
            onTimeUpdate={(e) => setCurrentMs(e.currentTarget.currentTime * 1000)}
            onLoadedMetadata={(e) =>
              setDurationMs(e.currentTarget.duration * 1000 || asset.durationMs || 0)
            }
            onEnded={() => setPlaying(false)}
            onError={() => setMediaError("Video preview unavailable")}
          />
        )}
        {mediaError ? (
          <div className="absolute inset-x-0 bottom-0 bg-charcoal-950/80 px-3 py-2 text-center text-[11px] text-warn">
            {mediaError}
          </div>
        ) : null}
      </div>

      {!isImage ? (
        <div className="space-y-2">
          <input
            type="range"
            min={0}
            max={Math.max(durationMs, 1)}
            value={Math.min(currentMs, durationMs || currentMs)}
            onChange={(e) => {
              const ms = Number(e.target.value);
              setCurrentMs(ms);
              if (mediaRef.current) mediaRef.current.currentTime = ms / 1000;
            }}
            className="w-full accent-[#5BA4A0]"
            data-testid="preview-seek"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="secondary" onClick={togglePlay} data-testid="preview-play">
              {playing ? "Pause" : "Play"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMuted((m) => !m)}
              data-testid="preview-mute"
            >
              {muted ? "Unmute" : "Mute"}
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-24 accent-[#5BA4A0]"
              aria-label="Volume"
              data-testid="preview-volume"
            />
            <span className="ml-auto font-mono text-[11px] text-charcoal-400" data-testid="preview-timecode">
              {formatDuration(currentMs)} / {formatDuration(durationMs || asset.durationMs)}
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
