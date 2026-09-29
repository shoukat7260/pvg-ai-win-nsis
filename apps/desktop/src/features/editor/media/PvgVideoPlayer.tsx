import { useEffect, useRef, useState } from "react";

export interface PvgVideoPlayerProps {
  src: string | null;
  poster?: string | null;
  /** Absolute media time in seconds (source clock). */
  currentTimeSec: number;
  playing: boolean;
  playbackRate?: number;
  muted?: boolean;
  volume?: number;
  className?: string;
  onTimeUpdate?: (timeSec: number) => void;
  onDuration?: (durationSec: number) => void;
  onError?: (message: string) => void;
  onCanPlay?: () => void;
  /** Seek tolerance (seconds) before forcing currentTime */
  seekEpsilonSec?: number;
}

/**
 * Controlled video element driven by the editor playback clock.
 * Does not own transport UI — parent (Program monitor) does.
 */
export function PvgVideoPlayer({
  src,
  poster,
  currentTimeSec,
  playing,
  playbackRate = 1,
  muted = true,
  volume = 0,
  className,
  onTimeUpdate,
  onDuration,
  onError,
  onCanPlay,
  seekEpsilonSec = 0.04,
}: PvgVideoPlayerProps) {
  const ref = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const genRef = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || !src) {
      setStatus("idle");
      return;
    }
    const gen = ++genRef.current;
    setStatus("loading");
    el.pause();
    el.src = src;
    el.load();
    const onLoaded = () => {
      if (gen !== genRef.current) return;
      setStatus("ready");
      onDuration?.(el.duration || 0);
      onCanPlay?.();
    };
    const onErr = () => {
      if (gen !== genRef.current) return;
      setStatus("error");
      onError?.(
        "Preview unavailable — codec unsupported or source not readable in this environment.",
      );
    };
    el.addEventListener("loadedmetadata", onLoaded);
    el.addEventListener("error", onErr);
    return () => {
      el.removeEventListener("loadedmetadata", onLoaded);
      el.removeEventListener("error", onErr);
      el.removeAttribute("src");
      el.load();
    };
  }, [src, onCanPlay, onDuration, onError]);

  // Seek when clock moves (scrub / frame step)
  useEffect(() => {
    const el = ref.current;
    if (!el || !src || status !== "ready") return;
    if (Math.abs(el.currentTime - currentTimeSec) > seekEpsilonSec) {
      try {
        el.currentTime = Math.max(0, currentTimeSec);
      } catch {
        /* ignore seek abort */
      }
    }
  }, [currentTimeSec, src, status, seekEpsilonSec]);

  useEffect(() => {
    const el = ref.current;
    if (!el || status !== "ready") return;
    el.playbackRate = playbackRate;
    el.muted = muted;
    el.volume = volume;
  }, [playbackRate, muted, volume, status]);

  useEffect(() => {
    const el = ref.current;
    if (!el || status !== "ready") return;
    if (playing) {
      void el.play().catch(() => {
        /* autoplay policies — clock still advances via store */
      });
    } else {
      el.pause();
    }
  }, [playing, status, src]);

  if (!src) return null;

  return (
    <video
      ref={ref}
      className={className}
      poster={poster ?? undefined}
      playsInline
      preload="auto"
      muted={muted}
      data-testid="pvg-video-player"
      data-status={status}
      onTimeUpdate={(e) => onTimeUpdate?.(e.currentTarget.currentTime)}
    />
  );
}
