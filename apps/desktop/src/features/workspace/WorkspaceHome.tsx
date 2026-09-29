import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { createProjectInputSchema } from "@/lib/schemas";
import { displayPath } from "@/lib/paths";
import { projectService } from "@/services/projects";
import { nativeApi } from "@/services/tauri";
import { useAppStore } from "@/state/appStore";
import { useConnectivity } from "@/hooks/useConnectivity";

type FramePresetId = "vertical" | "landscape" | "square" | "custom";

const FRAME_PRESETS: Record<
  Exclude<FramePresetId, "custom">,
  { label: string; width: number; height: number }
> = {
  vertical: { label: "Vertical 1080×1920", width: 1080, height: 1920 },
  landscape: { label: "Landscape 1920×1080", width: 1920, height: 1080 },
  square: { label: "Square 1080×1080", width: 1080, height: 1080 },
};

const FPS_OPTIONS = [24, 25, 30, 48, 50, 60] as const;

/**
 * create_project IPC currently accepts name / workspaceId / description only.
 * Frame size + fps are encoded into description until project settings are
 * accepted on create (UI-only persistence via description string).
 */
function buildCreateDescription(
  preset: FramePresetId,
  width: number,
  height: number,
  fps: number,
): string {
  const label =
    preset === "custom"
      ? `Custom ${width}x${height}`
      : FRAME_PRESETS[preset].label;
  return `Phase 3 project · preset=${label} · fps=${fps} (settings applied via description until create API accepts ProjectSettings)`;
}

export function WorkspaceHome() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspace = useAppStore((s) => s.currentWorkspace);
  const setWorkspace = useAppStore((s) => s.setWorkspace);
  const setUser = useAppStore((s) => s.setUser);
  const setProject = useAppStore((s) => s.setProject);
  const currentProject = useAppStore((s) => s.currentProject);
  const connectivity = useConnectivity();
  const [name, setName] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [preset, setPreset] = useState<FramePresetId>("landscape");
  const [customWidth, setCustomWidth] = useState(1920);
  const [customHeight, setCustomHeight] = useState(1080);
  const [fps, setFps] = useState<number>(30);

  const openInEditor = (project: typeof currentProject) => {
    if (!project) return;
    setProject(project);
    navigate("/app/edit");
  };

  const bootstrap = useMutation({
    mutationFn: () => nativeApi.ensureLocalWorkspace(),
    onSuccess: (info) => {
      setUser({
        id: info.userId,
        displayName: "Local Foundation User",
        isFoundationPlaceholder: true,
      });
      setWorkspace({
        id: info.workspaceId,
        displayName: info.displayName,
        projectsRoot: info.projectsRoot,
        dataRoot: info.dataRoot,
      });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });

  const projectsQuery = useQuery({
    queryKey: ["projects", workspace?.id],
    enabled: Boolean(workspace),
    queryFn: () => projectService.list(),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const dims =
        preset === "custom"
          ? { width: customWidth, height: customHeight }
          : FRAME_PRESETS[preset];
      const description = buildCreateDescription(
        preset,
        dims.width,
        dims.height,
        fps,
      );
      const parsed = createProjectInputSchema.safeParse({
        name,
        workspaceId: workspace?.id ?? "",
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
    onSuccess: (project) => {
      setName("");
      setFormError(null);
      setProject(project);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      navigate("/app/edit");
    },
    onError: (err: Error) => setFormError(err.message),
  });

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <header className="space-y-3">
        <Badge tone="accent">Phase 3 · Media foundation</Badge>
        <h1 className="font-display text-3xl font-semibold tracking-tight text-charcoal-100">
          Creative workstation foundation
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-charcoal-300">
          Local workspace, project presets, and media import — no timeline editor
          yet. Choose a frame size when creating a project.
        </p>
        <p className="text-xs text-charcoal-500">{connectivity.label}</p>
      </header>

      {!workspace ? (
        <GlassPanel className="p-6">
          <EmptyState
            title="No local workspace yet"
            description="Create a local test workspace under the PVG data root. Metadata persists through Tauri commands."
            action={
              <Button
                onClick={() => bootstrap.mutate()}
                disabled={bootstrap.isPending}
                data-testid="create-workspace"
              >
                {bootstrap.isPending ? "Creating…" : "Create local test workspace"}
              </Button>
            }
          />
          {bootstrap.isError ? (
            <div className="mt-4">
              <ErrorState
                message={(bootstrap.error as Error).message}
                onRetry={() => bootstrap.mutate()}
              />
            </div>
          ) : null}
        </GlassPanel>
      ) : (
        <>
          <GlassPanel className="grid gap-4 p-6 md:grid-cols-2">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-charcoal-500">
                Workspace
              </p>
              <p className="mt-1 font-display text-lg font-semibold">
                {workspace.displayName}
              </p>
              <p className="mt-2 font-mono text-xs text-charcoal-400" title={workspace.projectsRoot}>
                {displayPath(workspace.projectsRoot, 72)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-charcoal-500">
                Active project
              </p>
              <p className="mt-1 text-sm text-charcoal-200">
                {currentProject?.name ?? "None selected"}
              </p>
            </div>
          </GlassPanel>

          <GlassPanel className="p-6">
            <h2 className="font-display text-lg font-semibold">Create project</h2>
            <p className="mt-1 text-sm text-charcoal-400">
              Frame presets and fps are recorded in the project description until
              create_project accepts settings natively.
            </p>
            <form
              className="mt-4 flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                createMutation.mutate();
              }}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Project name"
                className="pvg-input pvg-input--light outline-none"
                data-testid="project-name-input"
              />

              <div>
                <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-charcoal-500">
                  Frame preset
                </p>
                <div className="flex flex-wrap gap-2" data-testid="project-presets">
                  {(Object.keys(FRAME_PRESETS) as Exclude<FramePresetId, "custom">[]).map(
                    (id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPreset(id)}
                        className={`rounded-xl border px-3 py-2 text-xs transition ${
                          preset === id
                            ? "border-accent/40 bg-accent-mute text-accent-bright"
                            : "border-white/10 text-charcoal-300 hover:bg-white/5"
                        }`}
                        data-testid={`preset-${id}`}
                      >
                        {FRAME_PRESETS[id].label}
                      </button>
                    ),
                  )}
                  <button
                    type="button"
                    onClick={() => setPreset("custom")}
                    className={`rounded-xl border px-3 py-2 text-xs transition ${
                      preset === "custom"
                        ? "border-accent/40 bg-accent-mute text-accent-bright"
                        : "border-white/10 text-charcoal-300 hover:bg-white/5"
                    }`}
                    data-testid="preset-custom"
                  >
                    Custom
                  </button>
                </div>
              </div>

              {preset === "custom" ? (
                <div className="flex flex-wrap gap-3" data-testid="custom-dimensions">
                  <label className="text-xs text-charcoal-400">
                    Width
                    <input
                      type="number"
                      min={16}
                      max={7680}
                      value={customWidth}
                      onChange={(e) => setCustomWidth(Number(e.target.value) || 1920)}
                      className="mt-1 block w-28 rounded-xl border border-white/10 bg-charcoal-900 px-3 py-2 text-sm text-charcoal-100"
                    />
                  </label>
                  <label className="text-xs text-charcoal-400">
                    Height
                    <input
                      type="number"
                      min={16}
                      max={7680}
                      value={customHeight}
                      onChange={(e) => setCustomHeight(Number(e.target.value) || 1080)}
                      className="mt-1 block w-28 rounded-xl border border-white/10 bg-charcoal-900 px-3 py-2 text-sm text-charcoal-100"
                    />
                  </label>
                </div>
              ) : null}

              <label className="text-xs text-charcoal-400">
                Frame rate
                <select
                  value={fps}
                  onChange={(e) => setFps(Number(e.target.value))}
                  className="mt-1 block w-36 rounded-xl border border-white/10 bg-charcoal-900 px-3 py-2 text-sm text-charcoal-100"
                  data-testid="project-fps"
                >
                  {FPS_OPTIONS.map((v) => (
                    <option key={v} value={v}>
                      {v} fps
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex justify-end">
                <Button type="submit" disabled={createMutation.isPending} data-testid="create-project">
                  {createMutation.isPending ? "Creating…" : "Create"}
                </Button>
              </div>
            </form>
            {formError || createMutation.isError ? (
              <div className="mt-3">
                <ErrorState message={formError ?? (createMutation.error as Error).message} />
              </div>
            ) : null}
          </GlassPanel>

          <section>
            <h2 className="mb-3 font-display text-lg font-semibold">Projects</h2>
            {projectsQuery.isLoading ? (
              <p className="text-sm text-charcoal-400 animate-soft-pulse">Loading projects…</p>
            ) : null}
            {projectsQuery.isError ? (
              <ErrorState
                message={(projectsQuery.error as Error).message}
                onRetry={() => void projectsQuery.refetch()}
              />
            ) : null}
            {projectsQuery.data && projectsQuery.data.projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                description="Create a local .pvg bundle to persist foundation metadata."
              />
            ) : null}
            <ul className="space-y-2">
              {projectsQuery.data?.projects.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded-surface border border-white/[0.06] bg-charcoal-900/50 px-4 py-3 text-left transition hover:border-accent/30"
                    onClick={() => openInEditor(project)}
                    data-testid={`project-${project.id}`}
                  >
                    <div>
                      <p className="font-medium text-charcoal-100">{project.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-charcoal-500">
                        {displayPath(project.path, 56)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>v{project.schemaVersion}</Badge>
                      <span className="text-xs text-accent-bright">Open editor</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
