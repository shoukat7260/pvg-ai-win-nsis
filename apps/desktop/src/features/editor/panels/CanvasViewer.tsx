import { useEffect, useMemo } from "react";
import { composeAtTime, SetTransformCommand } from "@pvg/editor-core";
import { useEditorStore } from "@/state/editorStore";
import { useAppStore } from "@/state/appStore";
import { useMediaStore } from "@/state/mediaStore";
import { CompositionLayer } from "@/features/editor/media/CompositionLayer";

/**
 * Program monitor — multi-layer composition from composeAtTime.
 * Playback clock: editorStore.playback.currentTimeMs.
 */
export function CanvasViewer() {
  const seq = useEditorStore((s) => s.getActiveSequence());
  const project = useEditorStore((s) => s.project);
  const projectPath =
    useEditorStore((s) => s.projectPath) ??
    useAppStore((s) => s.currentProject)?.path ??
    null;
  const playback = useEditorStore((s) => s.playback);
  const selection = useEditorStore((s) => s.selection);
  const setSelection = useEditorStore((s) => s.setSelection);
  const dispatch = useEditorStore((s) => s.dispatch);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const setPlaying = useEditorStore((s) => s.setPlaying);
  const previewSource = useMediaStore((s) => s.previewSource);
  const mediaAssets = useMediaStore((s) => s.assets);

  const layers = useMemo(() => {
    if (!seq) return [];
    return composeAtTime(seq, playback.currentTimeMs).filter(
      (l) => l.trackType !== "audio",
    );
  }, [seq, playback.currentTimeMs]);

  useEffect(() => {
    if (!playback.playing || !seq) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const store = useEditorStore.getState();
      const rate = store.playback.rate || 1;
      const next = store.playback.currentTimeMs + dt * rate;
      const dur = store.getActiveSequence()?.durationMs ?? seq.durationMs;
      if (next >= dur) {
        store.setPlayhead(dur);
        store.setPlaying(false);
        return;
      }
      store.setPlayhead(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playback.playing, seq]);

  if (!seq) return null;

  const aspect = seq.width / seq.height;
  const frameMs = 1000 / seq.frameRate;

  return (
    <div className="canvas-root" data-testid="canvas-viewer">
      <div className="canvas-toolbar">
        <div className="canvas-toolbar-left">
          <span className="ed-chip">Program</span>
          <span className="ed-muted">
            {seq.width}×{seq.height} · {layers.length} layer
            {layers.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="canvas-toolbar-right">
          <button
            type="button"
            className="ed-btn ghost"
            title="Play / Pause (Space)"
            aria-label={playback.playing ? "Pause" : "Play"}
            onClick={() => setPlaying(!playback.playing)}
            data-testid="program-play"
          >
            {playback.playing ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="ed-btn ghost"
            title="Previous frame"
            aria-label="Previous frame"
            onClick={() => setPlayhead(Math.max(0, playback.currentTimeMs - frameMs))}
          >
            −1f
          </button>
          <button
            type="button"
            className="ed-btn ghost"
            title="Next frame"
            aria-label="Next frame"
            onClick={() => setPlayhead(playback.currentTimeMs + frameMs)}
          >
            +1f
          </button>
          <span className="ed-chip muted">Fit</span>
        </div>
      </div>
      <div className="canvas-stage-wrap">
        <div
          className="canvas-stage program-stage"
          style={{ aspectRatio: `${aspect}` }}
          onClick={() => setSelection({ clipIds: [], trackIds: [] })}
          data-testid="program-stage"
        >
          <div className="canvas-safe title" aria-hidden />
          <div className="canvas-safe action" aria-hidden />
          {layers.map((layer) => {
            const asset =
              (layer.assetId &&
                (mediaAssets.find((a) => a.id === layer.assetId) ??
                  project?.assets?.find((a) => a.id === layer.assetId))) ||
              null;
            return (
              <CompositionLayer
                key={layer.clipId}
                layer={layer}
                selected={selection.clipIds.includes(layer.clipId)}
                projectPath={projectPath}
                asset={asset}
                previewSource={previewSource}
                playing={playback.playing}
                onSelect={() => setSelection({ clipIds: [layer.clipId] })}
                onDragTransform={(dx, dy) => {
                  if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
                  dispatch(
                    new SetTransformCommand(seq.id, layer.clipId, {
                      x: layer.x + dx,
                      y: layer.y + dy,
                    }),
                  );
                }}
              />
            );
          })}
          {layers.length === 0 ? (
            <p className="canvas-empty">Import media or add text to begin editing.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
