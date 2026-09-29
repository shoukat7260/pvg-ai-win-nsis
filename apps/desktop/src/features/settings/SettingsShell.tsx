import { NavLink, Outlet, Navigate, useLocation } from "react-router-dom";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { useAppStore } from "@/state/appStore";

const TABS = [
  { to: "/app/settings/account", label: "Account" },
  { to: "/app/settings/security", label: "Security" },
  { to: "/app/settings/connections", label: "Connections" },
  { to: "/app/settings/billing", label: "Billing" },
  { to: "/app/settings/preferences", label: "Preferences" },
] as const;

export function SettingsShell() {
  const location = useLocation();
  if (location.pathname === "/app/settings") {
    return <Navigate to="/app/settings/account" replace />;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-2 text-sm text-charcoal-400">
          Account, security, device-scoped connections, and billing.
        </p>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Settings sections">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) =>
              `rounded-xl px-3 py-2 text-sm ${
                isActive
                  ? "bg-accent-mute text-accent-bright"
                  : "text-charcoal-400 hover:bg-white/5 hover:text-charcoal-100"
              }`
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <Outlet />
    </div>
  );
}

export function PreferencesSettings() {
  const settings = useAppStore((s) => s.appSettings);
  const patchSettings = useAppStore((s) => s.patchSettings);

  return (
    <GlassPanel className="space-y-5 p-6" data-testid="settings-shell">
      <ToggleRow
        label="Show coming-later navigation"
        description="Keep Create / Edit / AI / Voice / Templates visible but disabled."
        checked={settings.showDisabledNav}
        onChange={(showDisabledNav) => patchSettings({ showDisabledNav })}
      />
      <ToggleRow
        label="Reduce motion"
        description="Prefer calmer transitions on the workstation shell."
        checked={settings.reduceMotion}
        onChange={(reduceMotion) => patchSettings({ reduceMotion })}
      />
      <ToggleRow
        label="Verbose diagnostics"
        description="Surface additional notes on the About screen."
        checked={settings.diagnosticsVerbose}
        onChange={(diagnosticsVerbose) => patchSettings({ diagnosticsVerbose })}
      />

      <div
        className="space-y-4 border-t border-white/[0.06] pt-5"
        data-testid="storage-performance-prefs"
      >
        <div>
          <h3 className="font-display text-base font-semibold text-charcoal-100">
            Storage / Performance
          </h3>
          <p className="mt-1 text-xs text-charcoal-400">
            Local preview preferences for the media workspace. These do not change
            project files on disk.
          </p>
        </div>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-charcoal-100">Proxy / preview mode</span>
          <select
            value={settings.proxyMode}
            onChange={(e) =>
              patchSettings({
                proxyMode: e.target.value as typeof settings.proxyMode,
              })
            }
            className="pvg-select pvg-input pvg-input--light"
            data-testid="pref-proxy-mode"
          >
            <option value="auto">Auto (prefer proxy when available)</option>
            <option value="proxy">Proxy</option>
            <option value="original">Original</option>
          </select>
        </label>

        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-charcoal-100">Preview quality display</span>
          <select
            value={settings.previewQuality}
            onChange={(e) =>
              patchSettings({
                previewQuality: e.target.value as typeof settings.previewQuality,
              })
            }
            className="pvg-select pvg-input pvg-input--light"
            data-testid="pref-preview-quality"
          >
            <option value="performance">Performance</option>
            <option value="balanced">Balanced</option>
            <option value="quality">Quality</option>
          </select>
        </label>
      </div>
    </GlassPanel>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-charcoal-100">{label}</span>
        <span className="mt-1 block text-xs text-charcoal-400">{description}</span>
      </span>
      <input
        type="checkbox"
        className="mt-1 h-4 w-4 accent-[#5BA4A0]"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
