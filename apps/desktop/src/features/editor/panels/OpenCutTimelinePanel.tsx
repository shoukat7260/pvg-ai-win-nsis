import {
  buildRulerTicksMs,
  getTimelineZoomMin,
  openCutLevelToPvgZoom,
  pvgZoomToOpenCutLevel,
  sliderToZoom,
  zoomToSlider,
} from "@pvg/opencut-integration";
import {
  MoveClipsCommand,
  MoveClipsToTrackCommand,
  TrimLeftCommand,
  TrimRightCommand,
  DeleteClipsCommand,
  RippleDeleteCommand,
  DuplicateClipsCommand,
  RollEditCommand,
  SetTrackPropertyCommand,
  RemoveMarkerCommand,
} from "@pvg/editor-core";
import { formatTimecode } from "@pvg/project-format";
import { useEditorStore } from "@/state/editorStore";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { ClipDerivativeVisuals } from "./ClipDerivativeVisuals";

const HEADER_WIDTH = 176;

export function OpenCutTimelinePanel() {
  const seq = useEditorStore((s) => s.getActiveSequence());
  const project = useEditorStore((s) => s.project);
  const projectPath = useEditorStore((s) => s.projectPath);
  const playback = useEditorStore((s) => s.playback);
  const timelineUi = useEditorStore((s) => s.timelineUi);
  const selection = useEditorStore((s) => s.selection);
  const setPlayhead = useEditorStore((s) => s.setPlayhead);
  const setSelection = useEditorStore((s) => s.setSelection);
  const setTimelineUi = useEditorStore((s) => s.setTimelineUi);
  const dispatch = useEditorStore((s) => s.dispatch);
  const setPlaying = useEditorStore((s) => s.setPlaying);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(1200);
  const [snapGuide, setSnapGuide] = useState<number | null>(null);
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    clipId: string;
    trackId: string;
  } | null>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  // Restore horizontal scroll from timelineUi.scrollMs
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !seq) return;
    const pxPerMs = (50 * timelineUi.zoom) / 1000;
    const target = timelineUi.scrollMs * pxPerMs;
    if (Math.abs(el.scrollLeft - target) > 2) {
      el.scrollLeft = target;
    }
  }, [seq?.id, timelineUi.zoom]);

  // Follow playhead while playing
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !playback.playing) return;
    const pxPerMs = (50 * timelineUi.zoom) / 1000;
    const x = playback.currentTimeMs * pxPerMs;
    const left = el.scrollLeft;
    const right = left + el.clientWidth;
    if (x < left + 40 || x > right - 80) {
      el.scrollLeft = Math.max(0, x - el.clientWidth * 0.35);
      setTimelineUi({ scrollMs: el.scrollLeft / pxPerMs });
    }
  }, [playback.currentTimeMs, playback.playing, timelineUi.zoom, setTimelineUi]);

  const durationMs = Math.max(seq?.durationMs ?? 0, 15_000);
  const fps = seq?.frameRate ?? 30;
  const zoomLevel = pvgZoomToOpenCutLevel(timelineUi.zoom);
  const minZoom = getTimelineZoomMin({ durationMs, containerWidth });
  const pxPerSecond = 50 * timelineUi.zoom;
  const pxPerMsActual = pxPerSecond / 1000;
  const widthPx = durationMs * pxPerMsActual + 240;

  const rulerTicks = useMemo(
    () => buildRulerTicksMs({ durationMs, zoomLevel, fps }),
    [durationMs, zoomLevel, fps],
  );

  const assetById = useMemo(() => {
    const map = new Map<string, NonNullable<typeof project>["assets"][number]>();
    for (const a of project?.assets ?? []) map.set(a.id, a);
    return map;
  }, [project?.assets]);

  if (!seq) return null;

  const sliderVal = zoomToSlider({ zoomLevel, minZoom });

  const findAdjacentRight = (trackId: string, clipId: string) => {
    const track = seq.tracks.find((t) => t.id === trackId);
    if (!track) return null;
    const clip = track.clips.find((c) => c.id === clipId);
    if (!clip || clip.timelineEndMs == null) return null;
    const end = clip.timelineEndMs;
    return (
      track.clips.find(
        (c) =>
          c.id !== clipId && Math.abs(c.timelineStartMs - end) < 0.5,
      ) ?? null
    );
  };

  const trackAtClientY = (clientY: number): string | null => {
    const lanes = document.querySelectorAll(".timeline-track");
    for (let i = 0; i < lanes.length; i++) {
      const el = lanes[i] as HTMLElement;
      const r = el.getBoundingClientRect();
      if (clientY >= r.top && clientY <= r.bottom) {
        return seq.tracks[i]?.id ?? null;
      }
    }
    return null;
  };

  return (
    <div
      className="timeline-root opencut-timeline"
      data-testid="opencut-timeline-panel"
      onClick={() => setCtxMenu(null)}
    >      <div className="timeline-toolbar">
        <div className="tl-tool-group" aria-label="Playback">
          <button
            type="button"
            className="ed-btn ghost"
            onClick={() => setPlaying(!playback.playing)}
            aria-label={playback.playing ? "Pause" : "Play"}
          >
            {playback.playing ? "Pause" : "Play"}
          </button>
          <span className="mono ed-chip" data-testid="timeline-timecode">
            {formatTimecode(playback.currentTimeMs, seq.frameRate)}
          </span>
        </div>
        <div className="tl-tool-group" aria-label="Editing">
          <button
            type="button"
            className={`ed-chip-btn ${timelineUi.snapEnabled ? "active" : ""}`}
            onClick={() => setTimelineUi({ snapEnabled: !timelineUi.snapEnabled })}
            title="Toggle snap"
          >
            Snap
          </button>
          <button
            type="button"
            className={`ed-chip-btn ${timelineUi.rippleMode === "ripple" ? "active" : ""}`}
            onClick={() =>
              setTimelineUi({
                rippleMode: timelineUi.rippleMode === "ripple" ? "off" : "ripple",
              })
            }
          >
            Ripple
          </button>
        </div>
        <div className="tl-tool-group tl-zoom" aria-label="Zoom">
          <button
            type="button"
            className="ed-btn ghost"
            aria-label="Zoom out"
            onClick={() => {
              const next = sliderToZoom({
                sliderPosition: Math.max(0, sliderVal - 0.08),
                minZoom,
              });
              setTimelineUi({ zoom: openCutLevelToPvgZoom(next) });
            }}
          >
            −
          </button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={sliderVal}
            onChange={(e) => {
              const next = sliderToZoom({
                sliderPosition: Number(e.target.value),
                minZoom,
              });
              setTimelineUi({ zoom: openCutLevelToPvgZoom(next) });
            }}
            aria-label="Timeline zoom"
          />
          <button
            type="button"
            className="ed-btn ghost"
            aria-label="Zoom in"
            onClick={() => {
              const next = sliderToZoom({
                sliderPosition: Math.min(1, sliderVal + 0.08),
                minZoom,
              });
              setTimelineUi({ zoom: openCutLevelToPvgZoom(next) });
            }}
          >
            +
          </button>
          <button
            type="button"
            className="ed-btn ghost"
            title="Fit timeline"
            onClick={() => setTimelineUi({ zoom: openCutLevelToPvgZoom(minZoom) })}
          >
            Fit
          </button>
        </div>
        {snapGuide !== null ? (
          <span className="ed-muted">Snap → {Math.round(snapGuide)} ms</span>
        ) : null}
      </div>

      <div className="timeline-body-split">
        <div className="timeline-headers" style={{ width: HEADER_WIDTH }}>
          <div className="timeline-header-ruler-spacer" />
          {seq.tracks.map((track) => (
            <div
              key={track.id}
              className="track-header-row"
              style={{ height: track.height }}
              data-testid={`track-header-${track.name}`}
            >
              <span className="track-name" title={track.name}>
                {track.name}
              </span>
              <span className={`track-type-pill type-${track.type}`}>
                {track.type === "video"
                  ? "Video"
                  : track.type === "audio"
                    ? "Audio"
                    : track.type === "text"
                      ? "Text"
                      : "Gfx"}
              </span>
              {track.type === "audio" ? (
                <>
                  <button
                    type="button"
                    className={`mini ${track.muted ? "on" : ""}`}
                    title="Mute"
                    aria-label="Mute"
                    aria-pressed={track.muted}
                    onClick={() =>
                      dispatch(
                        new SetTrackPropertyCommand(
                          seq.id,
                          track.id,
                          { muted: !track.muted },
                          track.muted ? "Unmute Track" : "Mute Track",
                        ),
                      )
                    }
                  >
                    M
                  </button>
                  <button
                    type="button"
                    className={`mini ${track.solo ? "on" : ""}`}
                    title="Solo"
                    aria-label="Solo"
                    aria-pressed={track.solo}
                    onClick={() =>
                      dispatch(
                        new SetTrackPropertyCommand(
                          seq.id,
                          track.id,
                          { solo: !track.solo },
                          "Solo Track",
                        ),
                      )
                    }
                  >
                    S
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={`mini ${!track.visible ? "on" : ""}`}
                  title="Visibility"
                  aria-label="Visibility"
                  aria-pressed={!track.visible}
                  onClick={() =>
                    dispatch(
                      new SetTrackPropertyCommand(
                        seq.id,
                        track.id,
                        { visible: !track.visible },
                        "Toggle Visibility",
                      ),
                    )
                  }
                >
                  V
                </button>
              )}
              <button
                type="button"
                className={`mini ${track.locked ? "on" : ""}`}
                title="Lock"
                aria-label="Lock"
                aria-pressed={track.locked}
                onClick={() =>
                  dispatch(
                    new SetTrackPropertyCommand(
                      seq.id,
                      track.id,
                      { locked: !track.locked },
                      track.locked ? "Unlock Track" : "Lock Track",
                    ),
                  )
                }
              >
                L
              </button>
            </div>
          ))}
        </div>

        <div
          className="timeline-scroll"
          ref={scrollRef}
          onScroll={(e) => {
            const left = e.currentTarget.scrollLeft;
            setTimelineUi({ scrollMs: left / pxPerMsActual });
          }}
        >
          <div className="timeline-canvas" style={{ width: widthPx }}>
            <div
              className="timeline-ruler"
              onMouseDown={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left + (scrollRef.current?.scrollLeft ?? 0);
                setPlayhead(Math.max(0, x / pxPerMsActual));
              }}
            >
              {rulerTicks.map((tick, i) => (
                <span
                  key={`${tick.timeMs}-${i}`}
                  className={tick.kind === "label" ? "ruler-mark" : "ruler-tick"}
                  style={{ left: tick.timeMs * pxPerMsActual }}
                />
              ))}
              <div
                className="playhead"
                style={{ left: playback.currentTimeMs * pxPerMsActual }}
                data-testid="playhead"
              />
              {seq.markers.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`timeline-marker ${selection.markerIds?.includes(m.id) ? "selected" : ""}`}
                  style={{ left: m.timeMs * pxPerMsActual }}
                  title={`${m.name} — click to select, Delete to remove`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlayhead(m.timeMs);
                    setSelection({
                      clipIds: [],
                      trackIds: [],
                      markerIds: [m.id],
                    });
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.confirm(`Delete marker “${m.name}”?`)) {
                      dispatch(new RemoveMarkerCommand(seq.id, m.id));
                    }
                  }}
                />
              ))}
            </div>

            <div className="timeline-tracks lanes-only">
              {seq.tracks.map((track) => (
                <div
                  key={track.id}
                  className={`timeline-track ${track.locked ? "locked" : ""}`}
                  style={{ height: track.height }}
                >
                  <div className="track-lane">
                    {track.clips.map((clip) => {
                      const end = clip.timelineEndMs ?? clip.timelineStartMs;
                      const w = Math.max(6, (end - clip.timelineStartMs) * pxPerMsActual);
                      const selected = selection.clipIds.includes(clip.id);
                      const asset = clip.assetId ? assetById.get(clip.assetId) : undefined;
                      const label =
                        clip.label ??
                        asset?.name ??
                        (clip.kind === "text" && clip.text?.content
                          ? clip.text.content.slice(0, 24)
                          : clip.kind);
                      return (
                        <div
                          key={clip.id}
                          className={`tl-clip kind-${clip.kind} ${selected ? "selected" : ""} ${!clip.enabled ? "disabled" : ""} ${asset?.proxy != null ? "has-proxy" : ""}`}
                          style={{
                            left: clip.timelineStartMs * pxPerMsActual,
                            width: w,
                          }}
                          title={label}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            if (e.shiftKey) {
                              setSelection({
                                clipIds: selected
                                  ? selection.clipIds.filter((id) => id !== clip.id)
                                  : [...selection.clipIds, clip.id],
                              });
                            } else {
                              setSelection({
                                clipIds: [clip.id],
                                trackIds: [track.id],
                                markerIds: [],
                              });
                            }
                            if (track.locked) return;
                            const startX = e.clientX;
                            const startY = e.clientY;
                            const origin = clip.timelineStartMs;
                            const onMove = (ev: MouseEvent) => {
                              setSnapGuide(origin + (ev.clientX - startX) / pxPerMsActual);
                            };
                            const onUp = (ev: MouseEvent) => {
                              window.removeEventListener("mousemove", onMove);
                              window.removeEventListener("mouseup", onUp);
                              setSnapGuide(null);
                              const deltaMs = (ev.clientX - startX) / pxPerMsActual;
                              const deltaY = Math.abs(ev.clientY - startY);
                              const ids =
                                selected && selection.clipIds.length > 1
                                  ? selection.clipIds
                                  : [clip.id];
                              const targetTrackId = trackAtClientY(ev.clientY);
                              if (
                                targetTrackId &&
                                targetTrackId !== track.id &&
                                deltaY > 12
                              ) {
                                dispatch(
                                  new MoveClipsToTrackCommand(
                                    seq.id,
                                    ids,
                                    targetTrackId,
                                    origin + deltaMs,
                                    timelineUi.snapEnabled,
                                  ),
                                );
                                return;
                              }
                              if (Math.abs(deltaMs) < 1) return;
                              dispatch(
                                new MoveClipsCommand(
                                  seq.id,
                                  ids,
                                  deltaMs,
                                  timelineUi.snapEnabled,
                                ),
                              );
                            };
                            window.addEventListener("mousemove", onMove);
                            window.addEventListener("mouseup", onUp);
                          }}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelection({
                              clipIds: [clip.id],
                              trackIds: [track.id],
                              markerIds: [],
                            });
                            setCtxMenu({
                              x: e.clientX,
                              y: e.clientY,
                              clipId: clip.id,
                              trackId: track.id,
                            });
                          }}
                        >
                          {clip.kind === "audio" ||
                          clip.kind === "video" ||
                          clip.kind === "image" ? (
                            <ClipDerivativeVisuals
                              kind={clip.kind}
                              projectPath={projectPath}
                              asset={asset}
                            />
                          ) : null}
                          <span
                            className="trim-handle left"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const startX = e.clientX;
                              const origin = clip.timelineStartMs;
                              const onUp = (ev: MouseEvent) => {
                                window.removeEventListener("mouseup", onUp);
                                dispatch(
                                  new TrimLeftCommand(
                                    seq.id,
                                    clip.id,
                                    origin + (ev.clientX - startX) / pxPerMsActual,
                                  ),
                                );
                              };
                              window.addEventListener("mouseup", onUp);
                            }}
                          />
                          <span className="clip-label">
                            {label}
                            {clip.speed !== 1 ? ` · ${clip.speed}x` : ""}
                          </span>
                          <span
                            className="trim-handle right"
                            title="Trim · Alt+drag for roll when adjacent"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              const startX = e.clientX;
                              const origin = end;
                              const adjacent = e.altKey
                                ? findAdjacentRight(track.id, clip.id)
                                : null;
                              const onUp = (ev: MouseEvent) => {
                                window.removeEventListener("mouseup", onUp);
                                const next = origin + (ev.clientX - startX) / pxPerMsActual;
                                if (adjacent) {
                                  dispatch(
                                    new RollEditCommand(
                                      seq.id,
                                      clip.id,
                                      adjacent.id,
                                      next,
                                    ),
                                  );
                                  return;
                                }
                                dispatch(
                                  new TrimRightCommand(seq.id, clip.id, next),
                                );
                              };
                              window.addEventListener("mouseup", onUp);
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      {ctxMenu ? (
        <div
          className="tl-context-menu"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          role="menu"
          data-testid="timeline-context-menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              const c = seq.tracks
                .flatMap((t) => t.clips)
                .find((x) => x.id === ctxMenu.clipId);
              const dur =
                c && c.timelineEndMs != null
                  ? c.timelineEndMs - c.timelineStartMs
                  : 1000;
              dispatch(
                new DuplicateClipsCommand(seq.id, [ctxMenu.clipId], dur),
              );
              setCtxMenu(null);
            }}
          >
            Duplicate
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              dispatch(new DeleteClipsCommand(seq.id, [ctxMenu.clipId]));
              setCtxMenu(null);
            }}
          >
            Delete
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              dispatch(new RippleDeleteCommand(seq.id, [ctxMenu.clipId]));
              setCtxMenu(null);
            }}
          >
            Ripple delete
          </button>
        </div>
      ) : null}
    </div>
  );
}
