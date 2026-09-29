import { NavLink } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/state/appStore";
import { useAuthStore } from "@/auth/authStore";
import { useConnectivity } from "@/hooks/useConnectivity";

const PRIMARY_NAV = [
  { to: "/app/home", label: "Home", enabled: true },
  { to: "/app/edit", label: "Edit", enabled: true },
  { to: "/app/media", label: "Media", enabled: true },
  { to: "/app/settings", label: "Settings", enabled: true },
  { to: "/app/about", label: "About", enabled: true },
] as const;

const FUTURE_NAV = [
  "Create",
  "AI",
  "Voice",
  "Templates",
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const workspace = useAppStore((s) => s.currentWorkspace);
  const project = useAppStore((s) => s.currentProject);
  const showDisabled = useAppStore((s) => s.appSettings.showDisabledNav);
  const connectivity = useConnectivity();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const initials =
    (user?.displayName || user?.email || "P")
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "P";

  return (
    <div className="flex min-h-screen bg-[#f7f7f5] text-[#0a0a0a]">
      <aside className="flex w-64 shrink-0 flex-col border-r border-white/10 bg-[#0a0a0a] px-4 py-6 text-[#f5f5f5]">
        <div className="mb-8 flex items-center gap-3 px-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[#0a0a0a]">
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
          <div>
            <p className="font-display text-lg font-semibold tracking-tight">PVG AI</p>
            <p className="text-[11px] text-[#a3a3a3]">Workstation</p>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Primary">
          <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
            Overview
          </p>
          {PRIMARY_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-xl px-3 py-2.5 text-sm transition ${
                  isActive
                    ? "bg-white font-semibold text-[#0a0a0a]"
                    : "text-[#a3a3a3] hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}

          {showDisabled ? (
            <div className="mt-6 space-y-1 border-t border-white/10 pt-4">
              <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
                Coming later
              </p>
              {FUTURE_NAV.map((label) => (
                <DisabledNavItem key={label} label={label} />
              ))}
            </div>
          ) : null}
        </nav>

        <div className="mt-auto space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-[#a3a3a3]">
          <div className="flex items-center gap-3" data-testid="shell-user-identity">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-[11px] font-bold text-[#0a0a0a]">
              {initials}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-[#f5f5f5]" title={user?.displayName}>
                {user?.displayName ?? "Signed in"}
              </p>
              <p className="truncate" title={user?.email}>
                {user?.email ?? ""}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2">
            <span>Mode</span>
            <Badge tone="accent">{connectivity.mode}</Badge>
          </div>
          <p className="truncate" title={workspace?.displayName}>
            {workspace?.displayName ?? "No workspace"}
          </p>
          <p className="truncate" title={project?.name}>
            {project ? `Project: ${project.name}` : "No project selected"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="w-full !text-[#d4d4d4] hover:!bg-white/5 hover:!text-white"
            onClick={() => void logout()}
            data-testid="shell-logout"
          >
            Log out
          </Button>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="relative z-10 flex-1 overflow-auto p-8 animate-fade-rise">
          {children}
        </div>
      </main>
    </div>
  );
}

function DisabledNavItem({ label }: { label: string }) {
  return (
    <button
      type="button"
      disabled
      title="Coming later"
      className="flex w-full cursor-not-allowed items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm text-[#525252]"
      data-testid={`nav-disabled-${label.toLowerCase()}`}
    >
      <span>{label}</span>
      <span className="text-[10px] uppercase tracking-wide text-[#404040]">
        Coming later
      </span>
    </button>
  );
}
