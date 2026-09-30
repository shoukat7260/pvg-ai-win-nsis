import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { convertFileSrc } from "@tauri-apps/api/core";
import { projectService } from "@/services/projects";
import { useAppStore } from "@/state/appStore";
import { CreateProjectDialog } from "./CreateProjectDialog";
import { useToastStore } from "@/components/ToastHost";
import { isBrowserPreview } from "@/lib/paths";
import type { ProjectMetadata } from "@/types";

function formatWhen(iso?: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function formatDuration(ms?: number) {
  if (!ms || ms <= 0) return "—";
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function thumbSrc(path?: string | null): string | null {
  if (!path) return null;
  if (path.startsWith("preview://") || path.startsWith("blob:") || path.startsWith("data:")) {
    return path;
  }
  if (isBrowserPreview()) return null;
  try {
    return convertFileSrc(path);
  } catch {
    return null;
  }
}

type SortKey = "updated" | "name" | "duration";

export function ProjectsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const workspace = useAppStore((s) => s.currentWorkspace);
  const setProject = useAppStore((s) => s.setProject);
  const pushToast = useToastStore((s) => s.push);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("updated");
  const [showTrash, setShowTrash] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const projectsQuery = useQuery({
    queryKey: ["projects", workspace?.id, showTrash ? "trash" : "active"],
    enabled: Boolean(workspace),
    queryFn: () => (showTrash ? projectService.listTrash() : projectService.list()),
  });

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = projectsQuery.data ?? [];
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "duration") return (b.durationMs ?? 0) - (a.durationMs ?? 0);
      return String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? ""));
    });
    return sorted;
  }, [projectsQuery.data, query, sort]);

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["projects"] });
  };

  const openProject = (project: ProjectMetadata) => {
    if (project.trashed) {
      pushToast("Restore the project before opening the editor.", "error");
      return;
    }
    setProject(project);
    navigate("/app/edit");
  };

  return (
    <div data-testid="projects-page">
      <div className="pvg-section-head" style={{ marginTop: 0 }}>
        <h2>{showTrash ? "Trash" : "Projects"}</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="pvg-input"
            style={{ width: 200 }}
            placeholder="Search projects"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            data-testid="projects-search"
          />
          <select
            className="pvg-input"
            style={{ width: 140 }}
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            aria-label="Sort projects"
            data-testid="projects-sort"
          >
            <option value="updated">Modified</option>
            <option value="name">Name</option>
            <option value="duration">Duration</option>
          </select>
          <button
            type="button"
            className="pvg-btn pvg-btn--ghost"
            onClick={() => setView(view === "grid" ? "list" : "grid")}
          >
            {view === "grid" ? "List" : "Grid"}
          </button>
          <button
            type="button"
            className="pvg-btn pvg-btn--ghost"
            data-testid="projects-toggle-trash"
            onClick={() => setShowTrash((v) => !v)}
          >
            {showTrash ? "Active projects" : "Trash"}
          </button>
          {!showTrash ? (
            <button
              type="button"
              className="pvg-btn pvg-btn--primary"
              onClick={() => setCreateOpen(true)}
              disabled={!workspace}
            >
              New project
            </button>
          ) : null}
        </div>
      </div>

      {!workspace ? (
        <div className="pvg-empty">
          <h3>Workspace not ready</h3>
          <p>Return to Home to initialize the local workspace.</p>
          <button type="button" className="pvg-btn pvg-btn--primary" onClick={() => navigate("/app/home")}>
            Go to Home
          </button>
        </div>
      ) : projectsQuery.isLoading ? (
        <p style={{ color: "var(--pvg-text-muted)" }}>Loading…</p>
      ) : projectsQuery.isError ? (
        <div className="pvg-empty">
          <h3>Could not load projects</h3>
          <p>{(projectsQuery.error as Error).message}</p>
          <button type="button" className="pvg-btn pvg-btn--primary" onClick={() => void projectsQuery.refetch()}>
            Retry
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="pvg-empty">
          <h3>{showTrash ? "Trash is empty" : "No projects yet"}</h3>
          <p>
            {showTrash
              ? "Deleted projects appear here until permanently removed."
              : "Create a project to start editing on the timeline."}
          </p>
          {!showTrash ? (
            <button type="button" className="pvg-btn pvg-btn--primary" onClick={() => setCreateOpen(true)}>
              Create project
            </button>
          ) : null}
        </div>
      ) : view === "grid" ? (
        <div className="pvg-project-grid">
          {filtered.map((p) => (
            <ProjectCard
              key={p.path}
              project={p}
              onOpen={() => openProject(p)}
              onChanged={refresh}
              trashMode={showTrash}
            />
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {filtered.map((p) => (
            <div
              key={p.path}
              className="pvg-tool-card"
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
            >
              <button
                type="button"
                style={{ all: "unset", cursor: "pointer", flex: 1 }}
                onClick={() => openProject(p)}
              >
                <span className="pvg-tool-card__title">{p.name}</span>
                <span className="pvg-tool-card__desc">
                  {formatWhen(p.updatedAt)} · {formatDuration(p.durationMs)}
                </span>
              </button>
              <ProjectActions project={p} trashMode={showTrash} onChanged={refresh} onOpen={() => openProject(p)} />
            </div>
          ))}
        </div>
      )}

      {createOpen && workspace ? (
        <CreateProjectDialog
          workspaceId={workspace.id}
          onClose={() => setCreateOpen(false)}
          onCreated={(project) => {
            setProject(project);
            refresh();
            setCreateOpen(false);
            navigate("/app/edit");
          }}
        />
      ) : null}
    </div>
  );
}

function ProjectCard({
  project,
  onOpen,
  onChanged,
  trashMode,
}: {
  project: ProjectMetadata;
  onOpen: () => void;
  onChanged: () => void;
  trashMode: boolean;
}) {
  const src = thumbSrc(project.thumbnailPath);
  return (
    <div className="pvg-project-card" style={{ cursor: "default" }} data-testid="project-card">
      <button
        type="button"
        onClick={onOpen}
        style={{ all: "unset", cursor: "pointer", display: "block", width: "100%" }}
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
          <div className="pvg-project-card__name">{project.name}</div>
          <div className="pvg-project-card__meta">
            {formatWhen(project.updatedAt)} · {formatDuration(project.durationMs)}
          </div>
        </div>
      </button>
      <div style={{ display: "flex", gap: 6, padding: "0 10px 10px", flexWrap: "wrap" }}>
        <ProjectActions project={project} trashMode={trashMode} onChanged={onChanged} onOpen={onOpen} />
      </div>
    </div>
  );
}

function ProjectActions({
  project,
  trashMode,
  onChanged,
  onOpen,
}: {
  project: ProjectMetadata;
  trashMode: boolean;
  onChanged: () => void;
  onOpen: () => void;
}) {
  const pushToast = useToastStore((s) => s.push);
  const current = useAppStore((s) => s.currentProject);
  const setProject = useAppStore((s) => s.setProject);

  const run = useMutation({
    mutationFn: async (action: string) => {
      if (action === "rename") {
        const next = window.prompt("Rename project", project.name);
        if (!next || next.trim() === project.name) return null;
        return projectService.rename(project.path, next.trim());
      }
      if (action === "duplicate") {
        return projectService.duplicate(project.path);
      }
      if (action === "trash") {
        if (!window.confirm(`Move “${project.name}” to Trash?`)) return null;
        const meta = await projectService.trash(project.path);
        if (current?.path === project.path) setProject(null);
        return meta;
      }
      if (action === "restore") {
        return projectService.restore(project.path);
      }
      if (action === "delete") {
        if (!window.confirm(`Permanently delete “${project.name}”? This cannot be undone.`)) {
          return null;
        }
        await projectService.deletePermanent(project.path);
        return true;
      }
      if (action === "thumb") {
        return projectService.generateThumbnail(project.path);
      }
      return null;
    },
    onSuccess: (result, action) => {
      if (result == null) return;
      onChanged();
      if (action === "rename") pushToast("Project renamed", "success");
      if (action === "duplicate") pushToast("Project duplicated", "success");
      if (action === "trash") pushToast("Moved to Trash", "success");
      if (action === "restore") pushToast("Project restored", "success");
      if (action === "delete") pushToast("Project permanently deleted", "success");
      if (action === "thumb") pushToast("Thumbnail updated", "success");
    },
    onError: (err: Error) => pushToast(err.message || "Project action failed", "error"),
  });

  const btn = {
    height: 28,
    fontSize: 11,
  } as const;

  if (trashMode) {
    return (
      <>
        <button
          type="button"
          className="pvg-btn pvg-btn--primary"
          style={btn}
          disabled={run.isPending}
          data-testid="project-restore"
          onClick={() => run.mutate("restore")}
        >
          Restore
        </button>
        <button
          type="button"
          className="pvg-btn pvg-btn--danger"
          style={btn}
          disabled={run.isPending}
          data-testid="project-delete-permanent"
          onClick={() => run.mutate("delete")}
        >
          Delete forever
        </button>
      </>
    );
  }

  return (
    <>
      <button type="button" className="pvg-btn pvg-btn--ghost" style={btn} onClick={onOpen}>
        Open
      </button>
      <button
        type="button"
        className="pvg-btn pvg-btn--ghost"
        style={btn}
        disabled={run.isPending}
        data-testid="project-rename"
        onClick={() => run.mutate("rename")}
      >
        Rename
      </button>
      <button
        type="button"
        className="pvg-btn pvg-btn--ghost"
        style={btn}
        disabled={run.isPending}
        data-testid="project-duplicate"
        onClick={() => run.mutate("duplicate")}
      >
        Duplicate
      </button>
      <button
        type="button"
        className="pvg-btn pvg-btn--ghost"
        style={btn}
        disabled={run.isPending}
        data-testid="project-regen-thumb"
        onClick={() => run.mutate("thumb")}
        title="Generate or refresh project cover from media"
      >
        Thumbnail
      </button>
      <button
        type="button"
        className="pvg-btn pvg-btn--ghost"
        style={btn}
        disabled={run.isPending}
        data-testid="project-trash"
        onClick={() => run.mutate("trash")}
      >
        Trash
      </button>
    </>
  );
}
