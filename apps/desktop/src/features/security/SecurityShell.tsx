import { useQuery } from "@tanstack/react-query";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { vaultService } from "@/services/vault";

export function SecurityShell() {
  const metaQuery = useQuery({
    queryKey: ["vault-metadata"],
    queryFn: () => vaultService.listMetadata(),
  });

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Security</h1>
        <p className="mt-2 text-sm text-charcoal-400">
          Credential vault metadata only. Secrets never enter persisted Zustand state.
        </p>
      </header>

      <GlassPanel className="space-y-4 p-6" data-testid="security-shell">
        <div className="flex items-center gap-2">
          <Badge tone="accent">Memory vault</Badge>
          <span className="text-xs text-charcoal-500">
            OS keychain backend planned for a later phase
          </span>
        </div>
        <p className="text-sm leading-relaxed text-charcoal-300">
          Phase 1 exposes <code className="font-mono text-accent-bright">has</code> and{" "}
          <code className="font-mono text-accent-bright">listMetadata</code> over IPC.
          Store/get/delete exist on the Rust trait with an in-memory implementation.
        </p>

        {metaQuery.isLoading ? (
          <p className="text-sm text-charcoal-400 animate-soft-pulse">Loading vault metadata…</p>
        ) : null}
        {metaQuery.isError ? (
          <ErrorState
            message={(metaQuery.error as Error).message}
            onRetry={() => void metaQuery.refetch()}
          />
        ) : null}
        {metaQuery.data && metaQuery.data.length === 0 ? (
          <EmptyState
            title="No credential metadata"
            description="Nothing stored in the Phase 1 memory vault. Authentication tokens arrive with Phase 2."
          />
        ) : null}
        <ul className="space-y-2">
          {metaQuery.data?.map((item) => (
            <li
              key={item.keyId}
              className="rounded-xl border border-white/10 bg-charcoal-900/60 px-4 py-3 text-sm"
            >
              <p className="font-medium">{item.label}</p>
              <p className="font-mono text-xs text-charcoal-500">{item.keyId}</p>
            </li>
          ))}
        </ul>
      </GlassPanel>
    </div>
  );
}
