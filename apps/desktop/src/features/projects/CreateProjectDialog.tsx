import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { createProjectInputSchema } from "@/lib/schemas";
import { projectService } from "@/services/projects";
import type { ProjectMetadata } from "@/types";

type PresetId = "16:9" | "9:16" | "1:1" | "4:5" | "4:3" | "custom";

const PRESETS: Record<Exclude<PresetId, "custom">, { w: number; h: number; label: string }> = {
  "16:9": { w: 1920, h: 1080, label: "16:9" },
  "9:16": { w: 1080, h: 1920, label: "9:16" },
  "1:1": { w: 1080, h: 1080, label: "1:1" },
  "4:5": { w: 1080, h: 1350, label: "4:5" },
  "4:3": { w: 1440, h: 1080, label: "4:3" },
};

const FPS = [24, 25, 30, 50, 60] as const;

export function CreateProjectDialog({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: (project: ProjectMetadata) => void;
}) {
  const [name, setName] = useState("Untitled project");
  const [preset, setPreset] = useState<PresetId>("16:9");
  const [customW, setCustomW] = useState(1920);
  const [customH, setCustomH] = useState(1080);
  const [fps, setFps] = useState<number>(30);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const dims =
        preset === "custom"
          ? { w: customW, h: customH, label: `Custom ${customW}x${customH}` }
          : PRESETS[preset];
      const description = `PVG project · canvas=${dims.label} · ${dims.w}x${dims.h} · fps=${fps}`;
      const parsed = createProjectInputSchema.safeParse({
        name,
        workspaceId,
        description,
      });
      if (!parsed.success) {
        throw new Error(parsed.error.issues[0]?.message ?? "Invalid project");
      }
      return projectService.create(
        parsed.data.name,
        parsed.data.workspaceId,
        parsed.data.description,
      );
    },
    onSuccess: (project) => onCreated(project),
    onError: (err: Error) => setError(err.message),
  });

  return (
    <div className="pvg-modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="pvg-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-project-title"
        data-testid="create-project-dialog"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="create-project-title">Create project</h2>
        <p className="pvg-modal__lead">Choose a canvas and frame rate, then open the editor.</p>

        <label>
          <span className="pvg-field-label">Project name</span>
          <input
            className="pvg-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="create-project-name"
            autoFocus
          />
        </label>

        <p className="pvg-field-label" style={{ marginTop: 14 }}>
          Canvas
        </p>
        <div className="pvg-preset-grid">
          {(Object.keys(PRESETS) as Exclude<PresetId, "custom">[]).map((id) => (
            <button
              key={id}
              type="button"
              className={`pvg-preset${preset === id ? " pvg-preset--active" : ""}`}
              onClick={() => setPreset(id)}
            >
              {PRESETS[id].label}
            </button>
          ))}
          <button
            type="button"
            className={`pvg-preset${preset === "custom" ? " pvg-preset--active" : ""}`}
            onClick={() => setPreset("custom")}
          >
            Custom
          </button>
        </div>

        {preset === "custom" ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
            <label>
              <span className="pvg-field-label">Width</span>
              <input
                className="pvg-input"
                type="number"
                min={16}
                value={customW}
                onChange={(e) => setCustomW(Number(e.target.value) || 16)}
              />
            </label>
            <label>
              <span className="pvg-field-label">Height</span>
              <input
                className="pvg-input"
                type="number"
                min={16}
                value={customH}
                onChange={(e) => setCustomH(Number(e.target.value) || 16)}
              />
            </label>
          </div>
        ) : null}

        <p className="pvg-field-label" style={{ marginTop: 14 }}>
          Frame rate
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {FPS.map((v) => (
            <button
              key={v}
              type="button"
              className={`pvg-preset${fps === v ? " pvg-preset--active" : ""}`}
              onClick={() => setFps(v)}
            >
              {v} fps
            </button>
          ))}
        </div>

        {error ? (
          <p className="pvg-auth-error" style={{ marginTop: 12 }} role="alert">
            {error}
          </p>
        ) : null}

        <div className="pvg-modal__actions">
          <button type="button" className="pvg-btn pvg-btn--ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="pvg-btn pvg-btn--primary"
            disabled={create.isPending}
            onClick={() => create.mutate()}
            data-testid="create-project-submit"
          >
            {create.isPending ? "Creating…" : "Create project"}
          </button>
        </div>
      </div>
    </div>
  );
}
