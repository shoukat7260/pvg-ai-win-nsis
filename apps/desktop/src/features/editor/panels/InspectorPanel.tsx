import { useMemo, useState } from "react";
import type { Clip } from "@pvg/project-format";
import {
  SetTransformCommand,
  SetSpeedCommand,
  SetReverseCommand,
  SetTransitionCommand,
  AddEffectCommand,
  AddKeyframeCommand,
  DeleteKeyframeCommand,
  newId,
} from "@pvg/editor-core";
import type { EditorCommand } from "@pvg/editor-core";
import { useEditorStore } from "@/state/editorStore";

export function InspectorPanel() {
  const seq = useEditorStore((s) => s.getActiveSequence());
  const selection = useEditorStore((s) => s.selection);
  const dispatch = useEditorStore((s) => s.dispatch);
  const project = useEditorStore((s) => s.project);
  const playback = useEditorStore((s) => s.playback);
  const [advanced, setAdvanced] = useState(false);

  const clips = useMemo(() => {
    if (!seq) return [] as Clip[];
    return seq.tracks
      .flatMap((t) => t.clips)
      .filter((c) => selection.clipIds.includes(c.id));
  }, [seq, selection.clipIds]);

  if (!seq || !project) return null;

  if (clips.length === 0) {
    const trackSummary = seq.tracks
      .map((t) => `${t.name} (${t.clips.length})`)
      .join(" · ");
    return (
      <div className="ed-panel inspector" data-testid="inspector-panel">
        <header className="ed-panel-h sticky">Sequence</header>
        <div className="ed-panel-b stack-gap">
          <Row label="Project" value={project.name} />
          <Row label="Sequence" value={seq.name} />
          <Row label="Resolution" value={`${seq.width} × ${seq.height}`} />
          <Row label="Frame rate" value={`${seq.frameRate} fps`} />
          <Row
            label="Duration"
            value={`${(seq.durationMs / 1000).toFixed(1)} s`}
          />
          <Row label="Tracks" value={String(seq.tracks.length)} />
          <p className="ed-hint">{trackSummary || "No clips yet"}</p>
          <p className="ed-hint">
            Append media, add text, or select a clip for transform, speed, and effects.
          </p>
        </div>
      </div>
    );
  }

  const primary = clips[0]!;
  const mixed = (getter: (c: Clip) => unknown) => {
    const first = getter(primary);
    return clips.some((c) => getter(c) !== first);
  };

  return (
    <div className="ed-panel inspector" data-testid="inspector-panel">
      <header className="ed-panel-h sticky">
        {clips.length > 1
          ? `Multi · ${clips.length} clips`
          : `${primary.kind.toUpperCase()} · ${primary.label ?? primary.id.slice(0, 8)}`}
      </header>
      <div className="ed-panel-b stack-gap">
        {clips.length > 1 ? (
          <p className="ed-hint">
            Shared values shown. Differing values show as Mixed — edits apply to all.
          </p>
        ) : null}
        <section>
          <h3 className="ed-section">Transform</h3>
          <NumField
            label="Position X"
            mixed={mixed((c) => c.transform.x)}
            value={primary.transform.x}
            onCommit={(v) =>
              clips.forEach((c) =>
                dispatch(new SetTransformCommand(seq.id, c.id, { x: v })),
              )
            }
          />
          <NumField
            label="Position Y"
            mixed={mixed((c) => c.transform.y)}
            value={primary.transform.y}
            onCommit={(v) =>
              clips.forEach((c) =>
                dispatch(new SetTransformCommand(seq.id, c.id, { y: v })),
              )
            }
          />
          <NumField
            label="Scale X"
            mixed={mixed((c) => c.transform.scaleX)}
            value={primary.transform.scaleX}
            step={0.01}
            onCommit={(v) =>
              clips.forEach((c) =>
                dispatch(new SetTransformCommand(seq.id, c.id, { scaleX: Math.max(0.01, v) })),
              )
            }
          />
          <NumField
            label="Scale Y"
            mixed={mixed((c) => c.transform.scaleY)}
            value={primary.transform.scaleY}
            step={0.01}
            onCommit={(v) =>
              clips.forEach((c) =>
                dispatch(new SetTransformCommand(seq.id, c.id, { scaleY: Math.max(0.01, v) })),
              )
            }
          />
          <NumField
            label="Rotation"
            mixed={mixed((c) => c.transform.rotation)}
            value={primary.transform.rotation}
            onCommit={(v) =>
              clips.forEach((c) =>
                dispatch(new SetTransformCommand(seq.id, c.id, { rotation: v })),
              )
            }
          />
          <NumField
            label="Opacity"
            mixed={mixed((c) => c.transform.opacity)}
            value={primary.transform.opacity}
            step={0.01}
            min={0}
            max={1}
            onCommit={(v) =>
              clips.forEach((c) =>
                dispatch(
                  new SetTransformCommand(seq.id, c.id, {
                    opacity: Math.min(1, Math.max(0, v)),
                  }),
                ),
              )
            }
          />
          <div className="ed-btn-row wrap" data-testid="keyframe-actions">
            {(
              [
                ["transform.x", "X"] as const,
                ["transform.y", "Y"] as const,
                ["transform.scaleX", "ScaleX"] as const,
                ["transform.scaleY", "ScaleY"] as const,
                ["transform.rotation", "Rot"] as const,
                ["transform.opacity", "Opacity"] as const,
              ]
            ).map(([path, label]) => (
              <button
                key={path}
                type="button"
                className="ed-btn ghost"
                title={`Add ${label} keyframe at playhead (clip-local)`}
                onClick={() =>
                  clips.forEach((c) => {
                    const local = Math.max(
                      0,
                      playback.currentTimeMs - c.timelineStartMs,
                    );
                    const value =
                      path === "transform.x"
                        ? c.transform.x
                        : path === "transform.y"
                          ? c.transform.y
                          : path === "transform.scaleX"
                            ? c.transform.scaleX
                            : path === "transform.scaleY"
                              ? c.transform.scaleY
                              : path === "transform.rotation"
                                ? c.transform.rotation
                                : c.transform.opacity;
                    dispatch(
                      new AddKeyframeCommand(seq.id, c.id, path, {
                        timeMs: local,
                        value,
                        interpolation: "linear",
                      }),
                    );
                  })
                }
              >
                ◇ {label}
              </button>
            ))}
          </div>
          {clips.length === 1 && Object.keys(primary.keyframes).length > 0 ? (
            <KeyframeList
              clip={primary}
              sequenceId={seq.id}
              dispatch={dispatch}
            />
          ) : null}
          {advanced ? (
            <>
              <NumField
                label="Anchor X"
                value={primary.transform.anchorX}
                step={0.01}
                onCommit={(v) =>
                  clips.forEach((c) =>
                    dispatch(new SetTransformCommand(seq.id, c.id, { anchorX: v })),
                  )
                }
              />
              <NumField
                label="Anchor Y"
                value={primary.transform.anchorY}
                step={0.01}
                onCommit={(v) =>
                  clips.forEach((c) =>
                    dispatch(new SetTransformCommand(seq.id, c.id, { anchorY: v })),
                  )
                }
              />
            </>
          ) : null}
          <button
            type="button"
            className="ed-btn ghost"
            onClick={() => setAdvanced((a) => !a)}
          >
            {advanced ? "Hide advanced" : "Advanced"}
          </button>
        </section>

        <section>
          <h3 className="ed-section">Speed</h3>
          <div className="ed-btn-row">
            {[0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4].map((s) => (
              <button
                key={s}
                type="button"
                className={`ed-chip-btn ${primary.speed === s ? "active" : ""}`}
                onClick={() =>
                  clips.forEach((c) =>
                    dispatch(new SetSpeedCommand(seq.id, c.id, s)),
                  )
                }
              >
                {s}x
              </button>
            ))}
          </div>
          <label className="ed-check">
            <input
              type="checkbox"
              checked={primary.reverse}
              onChange={(e) =>
                clips.forEach((c) =>
                  dispatch(new SetReverseCommand(seq.id, c.id, e.target.checked)),
                )
              }
            />
            Reverse
          </label>
        </section>

        <section>
          <h3 className="ed-section">Transition</h3>
          <button
            type="button"
            className="ed-btn"
            onClick={() =>
              clips.forEach((c) =>
                dispatch(
                  new SetTransitionCommand(seq.id, c.id, "in", {
                    id: newId(),
                    type: "dissolve",
                    durationMs: 500,
                    params: {},
                  }),
                ),
              )
            }
          >
            Add dissolve in
          </button>
          <button
            type="button"
            className="ed-btn ghost"
            onClick={() =>
              clips.forEach((c) =>
                dispatch(
                  new SetTransitionCommand(seq.id, c.id, "out", {
                    id: newId(),
                    type: "fade",
                    durationMs: 500,
                    params: {},
                  }),
                ),
              )
            }
          >
            Add fade out
          </button>
        </section>

        <section>
          <h3 className="ed-section">Effects</h3>
          <button
            type="button"
            className="ed-btn ghost"
            onClick={() =>
              clips.forEach((c) =>
                dispatch(
                  new AddEffectCommand(seq.id, c.id, {
                    id: newId(),
                    type: "blur",
                    enabled: true,
                    params: { amount: 4 },
                  }),
                ),
              )
            }
          >
            + Blur
          </button>
          <button
            type="button"
            className="ed-btn ghost"
            onClick={() =>
              clips.forEach((c) =>
                dispatch(
                  new AddEffectCommand(seq.id, c.id, {
                    id: newId(),
                    type: "brightness_contrast",
                    enabled: true,
                    params: { brightness: 0.1, contrast: 0.05 },
                  }),
                ),
              )
            }
          >
            + Brightness/Contrast
          </button>
          <ul className="ed-list">
            {primary.effects.map((fx) => (
              <li key={fx.id}>
                {fx.type} {fx.enabled ? "" : "(off)"}
              </li>
            ))}
          </ul>
        </section>

        {primary.kind === "text" && primary.text ? (
          <section>
            <h3 className="ed-section">Typography</h3>
            <Row label="Content" value={primary.text.content.slice(0, 40)} />
            <Row label="Font" value={primary.text.fontFamily} />
            <Row label="Size" value={String(primary.text.fontSize)} />
            <Row label="Color" value={primary.text.color} />
          </section>
        ) : null}
      </div>
    </div>
  );
}

function KeyframeList({
  clip,
  sequenceId,
  dispatch,
}: {
  clip: Clip;
  sequenceId: string;
  dispatch: (cmd: EditorCommand) => void;
}) {
  const entries = Object.entries(clip.keyframes).flatMap(([path, list]) =>
    (list ?? []).map((kf) => ({ path, kf })),
  );
  if (entries.length === 0) return null;
  return (
    <div className="kf-list" data-testid="keyframe-list">
      <h4 className="ed-section">Keyframes</h4>
      <ul className="ed-list">
        {entries.map(({ path, kf }) => (
          <li key={kf.id}>
            <span>
              {path.replace("transform.", "")} @ {Math.round(kf.timeMs)}ms ={" "}
              {typeof kf.value === "number" ? kf.value.toFixed(2) : String(kf.value)}
              {kf.interpolation !== "linear" ? ` · ${kf.interpolation}` : ""}
            </span>
            <button
              type="button"
              className="ed-btn ghost"
              aria-label="Delete keyframe"
              onClick={() =>
                dispatch(
                  new DeleteKeyframeCommand(sequenceId, clip.id, path, kf.id),
                )
              }
            >
              ×
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="ed-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function NumField({
  label,
  value,
  onCommit,
  mixed,
  step = 1,
  min,
  max,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
  mixed?: boolean;
  step?: number;
  min?: number;
  max?: number;
}) {
  const [draft, setDraft] = useState(String(value));
  return (
    <label className="ed-num">
      <span>{label}</span>
      <input
        type="text"
        className="pvg-input pvg-input--compact"
        inputMode="decimal"
        value={mixed ? "—" : draft}
        aria-label={label}
        onFocus={() => setDraft(String(value))}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (mixed) return;
          const n = Number(draft);
          if (!Number.isFinite(n)) {
            setDraft(String(value));
            return;
          }
          let v = n;
          if (min !== undefined) v = Math.max(min, v);
          if (max !== undefined) v = Math.min(max, v);
          onCommit(v);
          setDraft(String(v));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setDraft(String(value));
            (e.target as HTMLInputElement).blur();
          }
          if (e.key === "ArrowUp") {
            e.preventDefault();
            onCommit(value + step);
            setDraft(String(value + step));
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            onCommit(value - step);
            setDraft(String(value - step));
          }
        }}
      />
    </label>
  );
}
