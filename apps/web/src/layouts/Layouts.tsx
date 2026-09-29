import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/auth/authStore";

const NAV = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: "grid", end: true }],
  },
  {
    label: "Workspace",
    items: [
      { to: "/settings", label: "Account", icon: "user", end: true },
      { to: "/settings/security", label: "Security", icon: "shield", end: false },
      { to: "/settings/devices", label: "Devices", icon: "device", end: false },
      { to: "/settings/connections", label: "Connections", icon: "plug", end: false },
      { to: "/settings/billing", label: "Billing", icon: "card", end: false },
    ],
  },
] as const;

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/settings": "Account",
  "/settings/security": "Security",
  "/settings/devices": "Devices",
  "/settings/connections": "Connections",
  "/settings/billing": "Billing",
};

export function PublicLayout() {
  return (
    <div className="public-shell min-h-screen font-body">
      <header className="public-shell__header">
        <Link to="/" className="public-shell__brand" aria-label="PVG AI home">
          <span className="public-shell__mark" aria-hidden>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path
                d="M4 16.5 12 4l8 12.5H4Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path d="M8.2 16.5h7.6" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </span>
          <span className="public-shell__wordmark">PVG AI</span>
        </Link>
        <nav className="public-shell__nav">
          <Link to="/pricing">Pricing</Link>
          <Link to="/login">Sign in</Link>
          <Link to="/signup" className="public-shell__cta">
            Sign up
          </Link>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const title = TITLES[location.pathname] ?? "Workspace";
  const initials =
    (user?.displayName || user?.email || "P")
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "P";

  return (
    <div
      className={`app-shell ${collapsed ? "app-shell--collapsed" : ""}`}
      data-theme="studio"
    >
      <div
        className={`app-shell__scrim ${drawerOpen ? "is-open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden
      />

      <aside className={`app-shell__drawer ${drawerOpen ? "is-open" : ""}`}>
        <div className="app-shell__brand">
          <Link to="/dashboard" className="app-shell__logo" aria-label="PVG AI home">
            <span className="app-shell__mark" aria-hidden>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                <path
                  d="M4 16.5 12 4l8 12.5H4Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
                <path d="M8.2 16.5h7.6" stroke="currentColor" strokeWidth="1.6" />
              </svg>
            </span>
            {!collapsed ? <span className="app-shell__wordmark">PVG AI</span> : null}
          </Link>
          <button
            type="button"
            className="app-shell__collapse"
            onClick={() => setCollapsed((v) => !v)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <Icon name={collapsed ? "chevron-right" : "chevron-left"} />
          </button>
        </div>

        <nav className="app-shell__nav" aria-label="Workspace">
          {NAV.map((group) => (
            <div key={group.label} className="app-shell__group">
              {!collapsed ? (
                <p className="app-shell__group-label">{group.label}</p>
              ) : null}
              <ul>
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        `app-shell__link ${isActive ? "is-active" : ""}`
                      }
                      title={item.label}
                    >
                      <Icon name={item.icon} />
                      {!collapsed ? <span>{item.label}</span> : null}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="app-shell__footer">
          <div className="app-shell__user" data-testid="web-user-identity">
            <span className="app-shell__avatar">{initials}</span>
            {!collapsed ? (
              <div className="app-shell__user-meta">
                <p className="app-shell__user-name">{user?.displayName ?? "Creator"}</p>
                <p className="app-shell__user-email">{user?.email}</p>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="app-shell__logout"
            onClick={() => void logout()}
            data-testid="web-logout"
          >
            <Icon name="logout" />
            {!collapsed ? <span>Log out</span> : null}
          </button>
        </div>
      </aside>

      <div className="app-shell__main">
        <header className="app-shell__topbar">
          <div className="app-shell__topbar-left">
            <button
              type="button"
              className="app-shell__menu"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>
            <div>
              <p className="app-shell__eyebrow">Workspace</p>
              <h1 className="app-shell__page-title">{title}</h1>
            </div>
          </div>
          <div className="app-shell__topbar-right">
            <span className="app-shell__chip">Local-first</span>
            <span className="app-shell__chip app-shell__chip--solid">
              {user?.status?.replaceAll("_", " ") ?? "account"}
            </span>
          </div>
        </header>
        <main className="app-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function Icon({ name }: { name: string }) {
  const common = {
    viewBox: "0 0 24 24",
    width: 18,
    height: 18,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const paths: Record<string, ReactNode> = {
    grid: (
      <>
        <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
        <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
        <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 19.5c1.8-3.2 4-4.8 7-4.8s5.2 1.6 7 4.8" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3.5 5 6.5v5.2c0 4.2 2.8 7.4 7 8.8 4.2-1.4 7-4.6 7-8.8V6.5L12 3.5Z" />
      </>
    ),
    device: (
      <>
        <rect x="4" y="5" width="16" height="11" rx="2" />
        <path d="M9 19h6" />
      </>
    ),
    plug: (
      <>
        <path d="M9 7v4M15 7v4M8 11h8v2.5A4.5 4.5 0 0 1 11.5 18h-1A4.5 4.5 0 0 1 6 13.5V11h2" />
        <path d="M12 18v3" />
      </>
    ),
    card: (
      <>
        <rect x="3.5" y="6" width="17" height="12" rx="2" />
        <path d="M3.5 10h17" />
      </>
    ),
    logout: (
      <>
        <path d="M10 5H6.5A2.5 2.5 0 0 0 4 7.5v9A2.5 2.5 0 0 0 6.5 19H10" />
        <path d="M14 12H8M14 12l-2.5-2.5M14 12l-2.5 2.5" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    "chevron-left": <path d="M14 6l-6 6 6 6" />,
    "chevron-right": <path d="M10 6l6 6-6 6" />,
  };
  return <svg {...common}>{paths[name]}</svg>;
}
