import { GlassPanel } from "@/components/ui/GlassPanel";

type ShortcutGroup =
  | "Timeline"
  | "Playback"
  | "Editing"
  | "Navigation"
  | "Panels"
  | "Project"
  | "Application";

interface ShortcutRow {
  action: string;
  keys: string;
  group: ShortcutGroup;
}

/** Read-only defaults matching EditorKeyboardLayer / CommandPalette / shell. */
const DEFAULT_SHORTCUTS: ShortcutRow[] = [
  { group: "Timeline", action: "Split clip at playhead", keys: "S" },
  { group: "Timeline", action: "Add marker", keys: "N" },
  { group: "Timeline", action: "Toggle snap", keys: "M" },
  { group: "Timeline", action: "Zoom timeline in", keys: "—" },
  { group: "Timeline", action: "Zoom timeline out", keys: "—" },

  { group: "Playback", action: "Play / pause", keys: "Space" },
  { group: "Playback", action: "Step back (JKL)", keys: "J" },
  { group: "Playback", action: "Stop", keys: "K" },
  { group: "Playback", action: "Step forward (JKL)", keys: "L" },
  { group: "Playback", action: "Previous frame", keys: "←" },
  { group: "Playback", action: "Next frame", keys: "→" },

  { group: "Editing", action: "Delete selection", keys: "Delete / Backspace" },
  { group: "Editing", action: "Undo", keys: "Ctrl/Cmd+Z" },
  { group: "Editing", action: "Redo", keys: "Ctrl/Cmd+Shift+Z / Ctrl+Y" },
  { group: "Editing", action: "Copy", keys: "Ctrl/Cmd+C" },
  { group: "Editing", action: "Paste at playhead", keys: "Ctrl/Cmd+V" },

  { group: "Navigation", action: "Command palette", keys: "Ctrl/Cmd+K" },
  { group: "Navigation", action: "Close dialog / palette", keys: "Esc" },

  { group: "Panels", action: "Open Media browser", keys: "—" },
  { group: "Panels", action: "Open Inspector", keys: "—" },
  { group: "Panels", action: "Open AI Copilot", keys: "—" },

  { group: "Project", action: "Save project", keys: "Ctrl/Cmd+S" },

  { group: "Application", action: "Settings (via app nav)", keys: "—" },
];

const GROUPS: ShortcutGroup[] = [
  "Timeline",
  "Playback",
  "Editing",
  "Navigation",
  "Panels",
  "Project",
  "Application",
];

export function KeyboardShortcutsSettings() {
  return (
    <GlassPanel className="space-y-6 p-6" data-testid="settings-keyboard-shortcuts">
      <div>
        <h2 className="font-display text-lg font-semibold text-charcoal-100">
          Keyboard Shortcuts
        </h2>
        <p className="mt-1 text-sm text-charcoal-400">
          Defaults (customization coming soon)
        </p>
      </div>

      {GROUPS.map((group) => {
        const rows = DEFAULT_SHORTCUTS.filter((r) => r.group === group);
        if (!rows.length) return null;
        return (
          <section key={group} className="space-y-2">
            <h3 className="text-sm font-medium text-charcoal-200">{group}</h3>
            <div className="overflow-hidden rounded-xl border border-white/[0.08]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] bg-white/[0.03] text-xs text-charcoal-400">
                    <th className="px-3 py-2 font-medium">Action</th>
                    <th className="px-3 py-2 font-medium">Keys</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={`${group}-${row.action}`}
                      className="border-b border-white/[0.04] last:border-0"
                    >
                      <td className="px-3 py-2 text-charcoal-100">{row.action}</td>
                      <td className="px-3 py-2">
                        <kbd className="rounded-md bg-white/[0.06] px-2 py-0.5 font-mono text-xs text-charcoal-200">
                          {row.keys}
                        </kbd>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </GlassPanel>
  );
}
