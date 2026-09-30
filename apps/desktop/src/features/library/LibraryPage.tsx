import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { projectService } from "@/services/projects";
import { useAppStore } from "@/state/appStore";

const SECTIONS = [
  "Projects",
  "Videos",
  "Images",
  "Audio",
  "Templates",
  "Generated",
  "Exports",
  "Favorites",
  "Trash",
] as const;

export function LibraryPage() {
  const navigate = useNavigate();
  const workspace = useAppStore((s) => s.currentWorkspace);
  const setProject = useAppStore((s) => s.setProject);
  const [section, setSection] = useState<(typeof SECTIONS)[number]>("Projects");
  const [query, setQuery] = useState("");

  const projectsQuery = useQuery({
    queryKey: ["projects", workspace?.id],
    enabled: Boolean(workspace) && section === "Projects",
    queryFn: () => projectService.list(),
  });

  const filtered = (projectsQuery.data ?? []).filter((p) =>
    p.name.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <div data-testid="library-page">
      <div className="pvg-section-head" style={{ marginTop: 0 }}>
        <h2>Library</h2>
        <input
          className="pvg-input"
          style={{ width: 240 }}
          placeholder="Search library"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="pvg-library-layout">
        <aside className="pvg-library-side" aria-label="Library sections">
          {SECTIONS.map((s) => (
            <button
              key={s}
              type="button"
              aria-current={section === s}
              onClick={() => setSection(s)}
            >
              {s}
            </button>
          ))}
        </aside>

        <div>
          {section === "Projects" ? (
            !workspace ? (
              <div className="pvg-empty">
                <h3>Workspace not ready</h3>
                <p>Initialize from Home first.</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="pvg-empty">
                <h3>Your assets will appear here</h3>
                <p>Create a project or import media to fill the library.</p>
                <button
                  type="button"
                  className="pvg-btn pvg-btn--primary"
                  onClick={() => navigate("/app/home?create=1")}
                >
                  Create project
                </button>
              </div>
            ) : (
              <div className="pvg-project-grid">
                {filtered.map((p) => (
                  <button
                    key={p.path}
                    type="button"
                    className="pvg-project-card"
                    onClick={() => {
                      setProject(p);
                      navigate("/app/edit");
                    }}
                  >
                    <div className="pvg-project-card__thumb">Project</div>
                    <div className="pvg-project-card__body">
                      <div className="pvg-project-card__name">{p.name}</div>
                      <div className="pvg-project-card__meta">{p.path}</div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : section === "Templates" ? (
            <div className="pvg-empty">
              <h3>Browse templates</h3>
              <p>Original PVG templates will appear here. No third-party copyrighted packs.</p>
              <button
                type="button"
                className="pvg-btn pvg-btn--primary"
                onClick={() => navigate("/app/templates")}
              >
                Open Templates
              </button>
            </div>
          ) : (
            <div className="pvg-empty">
              <h3>{section}</h3>
              <p>
                {section === "Trash"
                  ? "Deleted items will appear here when trash is enabled."
                  : `No ${section.toLowerCase()} yet. Import media from Media or the editor.`}
              </p>
              <button
                type="button"
                className="pvg-btn pvg-btn--primary"
                onClick={() => navigate("/app/media")}
              >
                Open Media
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
