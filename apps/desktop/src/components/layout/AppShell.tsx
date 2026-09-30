import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/auth/authStore";
import { useAppStore } from "@/state/appStore";
import { useState } from "react";

const NAV = [
  { to: "/app/home", label: "Home" },
  { to: "/app/projects", label: "Projects" },
  { to: "/app/library", label: "Library" },
  { to: "/app/templates", label: "Templates" },
  { to: "/app/ai", label: "AI" },
  { to: "/app/media", label: "Media" },
] as const;

const SECONDARY = [
  { to: "/app/settings", label: "Settings" },
  { to: "/app/about", label: "About" },
] as const;

function BrandMark() {
  return (
    <span className="pvg-sidebar__mark" aria-hidden>
      <svg viewBox="0 0 24 24" width="14" height="14" fill="none">
        <path d="M3.5 18.5 12 5l8.5 13.5H3.5Z" fill="#E8F7FF" fillOpacity="0.95" />
        <path d="M8.2 18.5 12 11.2 15.8 18.5H8.2Z" fill="#0B1F3A" fillOpacity="0.55" />
        <rect x="7" y="19.2" width="10" height="1.4" rx="0.7" fill="#1EC8FF" />
      </svg>
    </span>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const project = useAppStore((s) => s.currentProject);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const initials =
    (user?.displayName || user?.email || "P")
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "P";

  return (
    <div className="pvg-shell" data-testid="app-shell">
      <aside className="pvg-sidebar" aria-label="Workspace navigation">
        <div className="pvg-sidebar__brand">
          <BrandMark />
          <div>
            <p className="pvg-sidebar__title">PVG AI</p>
            <p style={{ fontSize: 11, color: "var(--pvg-text-muted)", margin: 0 }}>
              Creative Studio
            </p>
          </div>
        </div>

        <nav className="pvg-sidebar__nav" aria-label="Primary">
          <p className="pvg-nav-label">Create</p>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `pvg-nav-link${isActive ? " pvg-nav-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          <p className="pvg-nav-label">Account</p>
          {SECONDARY.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `pvg-nav-link${isActive ? " pvg-nav-link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="pvg-sidebar__footer">
          {project ? (
            <button
              type="button"
              className="pvg-btn pvg-btn--primary"
              style={{ width: "100%" }}
              onClick={() => navigate("/app/edit")}
              data-testid="shell-open-editor"
            >
              Open editor
            </button>
          ) : null}
          <div className="pvg-user-chip" data-testid="shell-user-identity">
            <span className="pvg-user-chip__avatar">{initials}</span>
            <div className="pvg-user-chip__meta">
              <p className="pvg-user-chip__name" title={user?.displayName}>
                {user?.displayName ?? "Signed in"}
              </p>
              <p className="pvg-user-chip__email" title={user?.email}>
                {user?.email ?? ""}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="pvg-btn pvg-btn--ghost"
            style={{ width: "100%" }}
            onClick={() => void logout()}
            data-testid="shell-logout"
          >
            Sign out
          </button>
        </div>
      </aside>

      <div className="pvg-main">
        <header className="pvg-topbar">
          <input
            className="pvg-topbar__search"
            placeholder="Search projects, media, templates… (Ctrl+K soon)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search"
            data-testid="shell-search"
          />
          <button
            type="button"
            className="pvg-btn pvg-btn--primary"
            onClick={() => navigate("/app/home?create=1")}
            data-testid="shell-create"
          >
            + Create
          </button>
        </header>
        <main className="pvg-content">{children}</main>
      </div>
    </div>
  );
}
