import { Button } from "@/components/ui/Button";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { useDiagnostics } from "@/hooks/useDiagnostics";
import { useAppStore } from "@/state/appStore";
import { diagnosticsService } from "@/services/diagnostics";
import { useState } from "react";

export function AboutDiagnosticsScreen() {
  const verbose = useAppStore((s) => s.appSettings.diagnosticsVerbose);
  const { data, isLoading, isError, error, refetch } = useDiagnostics(true);
  const [progressNote, setProgressNote] = useState<string | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-6" data-testid="about-diagnostics">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          About / Diagnostics
        </h1>
        <p className="mt-2 text-sm text-charcoal-400">
          Safe runtime metadata — no secrets, no shell access.
        </p>
      </header>

      <GlassPanel className="p-6">
        {isLoading ? (
          <p className="text-sm text-charcoal-400 animate-soft-pulse">Collecting diagnostics…</p>
        ) : null}
        {isError ? (
          <ErrorState
            message={(error as Error).message}
            onRetry={() => void refetch()}
          />
        ) : null}
        {data ? (
          <dl className="grid gap-4 sm:grid-cols-2">
            <Diag label="Application" value={`${data.appName} ${data.appVersion}`} />
            <Diag label="Phase" value={data.phase} />
            <Diag label="Platform" value={`${data.os}/${data.arch}`} />
            <Diag label="Vault" value={data.vaultBackend} />
            <Diag label="Data root" value={data.dataRoot} mono />
            <Diag label="Workspace" value={data.workspaceRoot} mono />
            <Diag label="Connectivity" value={data.connectivityHint} />
          </dl>
        ) : null}

        {verbose && data ? (
          <ul className="mt-6 space-y-2 border-t border-white/10 pt-4">
            {data.notes.map((note) => (
              <li key={note} className="text-sm text-charcoal-300">
                · {note}
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button variant="ghost" onClick={() => void refetch()}>
            Refresh
          </Button>
          <Button
            variant="subtle"
            onClick={async () => {
              const evt = await diagnosticsService.emitProgressStub(`diag-${Date.now()}`);
              setProgressNote(evt.message);
            }}
          >
            Emit progress stub
          </Button>
          <Badge tone="muted">Async progress pattern</Badge>
        </div>
        {progressNote ? (
          <p className="mt-3 text-xs text-accent-bright" data-testid="progress-stub-note">
            {progressNote}
          </p>
        ) : null}
      </GlassPanel>
    </div>
  );
}

function Diag({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.14em] text-charcoal-500">{label}</dt>
      <dd className={`mt-1 text-sm text-charcoal-100 ${mono ? "font-mono text-xs break-all" : ""}`}>
        {value}
      </dd>
    </div>
  );
}
