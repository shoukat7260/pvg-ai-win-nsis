import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useSearchParams } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { projectService } from "@/services/projects";
import { nativeApi } from "@/services/tauri";
import { useAppStore } from "@/state/appStore";
import { useToastStore } from "@/components/ToastHost";
import { CreateProjectDialog } from "@/features/projects/CreateProjectDialog";
import { isBrowserPreview } from "@/lib/paths";
import type { ProjectMetadata } from "@/types";

const TOOLS = [
  { id: "new", title: "New project", desc: "Blank timeline with canvas presets." },
  { id: "ai-video", title: "AI video", desc: "Describe a clip and generate a plan." },
  { id: "ugc", title: "UGC ad", desc: "Product → brief → storyboard shell." },
  { id: "product", title: "Product video", desc: "Showcase products with templates." },
  { id: "social", title: "Social video", desc: "Vertical-first social presets." },
  { id: "import", title: "Import media", desc: "Bring local files into Library." },
] as const;

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function WorkspaceHome() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();
  const workspace = useAppStore((s) => s.currentWorkspace);
  const setWorkspace = useAppStore((s) => s.setWorkspace);
  const setUser = useAppStore((s) => s.setUser);
  const setProject = useAppStore((s) => s.setProject);
  const pushToast = useToastStore((s) => s.push);
  const [createOpen, setCreateOpen] = useState(params.get("create") === "1");
  const [toolNotice, setToolNotice] = useState<string | null>(null);
  const workspaceReadyToasted = useRef(false);

  useEffect(() => {
    if (params.get("create") === "1") setCreateOpen(true);
  }, [params]);

  const bootstrap = useMutation({
    mutationFn: () => nativeApi.ensureLocalWorkspace(),
    onSuccess: (info) => {
      setUser({
        id: info.userId,
        displayName: "Local workspace",
        isFoundationPlaceholder: true,
      });
      setWorkspace({
        id: info.workspaceId,
        displayName: info.displayName,
        projectsRoot: info.projectsRoot,
        dataRoot: info.dataRoot,
      });
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (!workspaceReadyToasted.current) {
        workspaceReadyToasted.current = true;
        pushToast("Workspace ready", "success");
      }
    },
  });

  useEffect(() => {
    if (!workspace && !bootstrap.isPending && !bootstrap.isSuccess) {
      bootstrap.mutate();
    }
    // Intentionally once on mount when workspace missing
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const projectsQuery = useQuery({
    queryKey: ["projects", workspace?.id],
    enabled: Boolean(workspace),
    queryFn: () => projectService.list(),
  });

  const recent = useMemo(() => {
    const list = projectsQuery.data ?? [];
    return [...list]
      .sort((a, b) => String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")))
      .slice(0, 8);
  }, [projectsQuery.data]);

  const openProject = (project: ProjectMetadata) => {
    setProject(project);
    navigate("/app/edit");
  };

  const onTool = (id: (typeof TOOLS)[number]["id"]) => {
    if (id === "new") {
      setCreateOpen(true);
      return;
    }
    if (id === "import") {
      navigate("/app/media");
      return;
    }
    if (id === "ai-video" || id === "ugc") {
      navigate(`/app/ai?intent=${id}`);
      return;
    }
    setToolNotice("Not yet available — coming in a later phase.");
  };

  return (
    <div data-testid="workspace-home">
      <button
        type="button"
        className="pvg-create-hero"
        onClick={() => setCreateOpen(true)}
        data-testid="home-create-project"
      >
        + Create project
      </button>

      <div className="pvg-tool-row">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            className="pvg-tool-card"
            onClick={() => onTool(t.id)}
            data-testid={`home-tool-${t.id}`}
          >
            <span className="pvg-tool-card__title">{t.title}</span>
            <span className="pvg-tool-card__desc">{t.desc}</span>
          </button>
        ))}
      </div>
      {toolNotice ? (
        <p style={{ marginTop: 10, fontSize: 12, color: "var(--pvg-warning)" }} role="status">
          {toolNotice}
        </p>
      ) : null}

      <div className="pvg-section-head">
        <h2>Recent projects</h2>
        <button
          type="button"
          className="pvg-btn pvg-btn--ghost"
          onClick={() => navigate("/app/projects")}
        >
          View all
        </button>
      </div>

      {!workspace ? (
        <div className="pvg-empty">
          <h3>Preparing local workspace…</h3>
          <p>PVG AI stores projects and media on this device.</p>
          {bootstrap.isError ? (
            <button type="button" className="pvg-btn pvg-btn--primary" onClick={() => bootstrap.mutate()}>
              Retry
            </button>
          ) : null}
        </div>
      ) : projectsQuery.isLoading ? (
        <p style={{ color: "var(--pvg-text-muted)", fontSize: 13 }}>Loading projects…</p>
      ) : projectsQuery.isError ? (
        <div className="pvg-empty">
          <h3>Could not load projects</h3>
          <p>{(projectsQuery.error as Error).message}</p>
          <button
            type="button"
            className="pvg-btn pvg-btn--primary"
            onClick={() => void projectsQuery.refetch()}
          >
            Retry
          </button>
        </div>
      ) : recent.length === 0 ? (
        <div className="pvg-empty" data-testid="home-empty-projects">
          <h3>Create your first project</h3>
          <p>Projects stay on this device. Open the editor when you are ready to cut.</p>
          <button
            type="button"
            className="pvg-btn pvg-btn--primary"
            onClick={() => setCreateOpen(true)}
          >
            New project
          </button>
        </div>
      ) : (
        <div className="pvg-project-grid" data-testid="home-recent-projects">
          {recent.map((p) => {
            let src: string | null = null;
            if (p.thumbnailPath && !isBrowserPreview()) {
              try {
                src = convertFileSrc(p.thumbnailPath);
              } catch {
                src = null;
              }
            }
            return (
              <button
                key={p.path}
                type="button"
                className="pvg-project-card"
                onClick={() => openProject(p)}
                data-testid="project-card"
              >
                <div
                  className="pvg-project-card__thumb"
                  style={
                    src
                      ? {
                          backgroundImage: `url(${src})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }
                      : undefined
                  }
                >
                  {!src ? "PVG" : null}
                </div>
                <div className="pvg-project-card__body">
                  <div className="pvg-project-card__name">{p.name}</div>
                  <div className="pvg-project-card__meta">{formatWhen(p.updatedAt)}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {createOpen && workspace ? (
        <CreateProjectDialog
          workspaceId={workspace.id}
          onClose={() => {
            setCreateOpen(false);
            if (params.get("create") === "1") {
              params.delete("create");
              setParams(params, { replace: true });
            }
          }}
          onCreated={(project) => {
            setProject(project);
            void queryClient.invalidateQueries({ queryKey: ["projects"] });
            setCreateOpen(false);
            navigate("/app/edit");
          }}
        />
      ) : null}
    </div>
  );
}
