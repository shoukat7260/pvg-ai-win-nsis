import { GlassPanel } from "@/components/ui/GlassPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useUiStore } from "@/state/uiStore";

export function LoginPlaceholder() {
  const setBootComplete = useUiStore((s) => s.setBootComplete);

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal-950 px-6">
      <GlassPanel className="w-full max-w-md p-8 animate-fade-rise">
        <p className="font-display text-2xl font-semibold tracking-tight">PVG AI</p>
        <p className="mt-1 text-sm text-charcoal-400">Product Generator AI</p>

        <div className="mt-6 rounded-xl border border-warn/25 bg-warn-mute px-4 py-3">
          <Badge tone="warn">Foundation only</Badge>
          <p className="mt-2 text-sm text-charcoal-200" data-testid="login-foundation-banner">
            Foundation only — authentication arrives in Phase 2
          </p>
        </div>

        <div className="mt-6 space-y-3 opacity-60">
          <label className="block text-xs text-charcoal-400">
            Email
            <input
              disabled
              placeholder="Coming in Phase 2"
              className="mt-1 w-full rounded-xl border border-white/10 bg-charcoal-900 px-3 py-2.5 text-sm"
            />
          </label>
          <label className="block text-xs text-charcoal-400">
            Password
            <input
              disabled
              type="password"
              placeholder="••••••••"
              className="mt-1 w-full rounded-xl border border-white/10 bg-charcoal-900 px-3 py-2.5 text-sm"
            />
          </label>
        </div>

        <Button
          className="mt-6 w-full"
          onClick={() => setBootComplete(true)}
          data-testid="continue-foundation"
        >
          Continue to local foundation
        </Button>
        <p className="mt-3 text-center text-xs text-charcoal-500">
          Continues in LOCAL_ONLY mode with a local test workspace.
        </p>
      </GlassPanel>
    </div>
  );
}
