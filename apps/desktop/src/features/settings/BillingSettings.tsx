import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { getApiClient } from "@/auth/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export function BillingSettings() {
  const qc = useQueryClient();
  const billingQuery = useQuery({
    queryKey: ["billing"],
    queryFn: () => getApiClient().getBilling(),
    retry: false,
  });

  const billing = billingQuery.data;

  return (
    <div className="space-y-6" data-testid="settings-billing">
      <GlassPanel className="space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold">Current plan</h2>
        {billingQuery.isLoading ? (
          <p className="text-sm text-charcoal-400">Loading billing…</p>
        ) : null}
        {billingQuery.isError ? (
          <p className="text-sm text-charcoal-400" data-testid="billing-unavailable">
            Billing details unavailable until the API is ready. No live payments are simulated.
          </p>
        ) : null}
        {billing?.plan ? (
          <>
            <div className="flex items-center gap-3">
              <p className="text-2xl font-display font-semibold" data-testid="billing-plan-name">
                {billing.plan.name}
              </p>
              <Badge tone="accent">{billing.plan.tier}</Badge>
              <Badge>{billing.status}</Badge>
            </div>
            {billing.plan.description ? (
              <p className="text-sm text-charcoal-400">{billing.plan.description}</p>
            ) : null}
            <ul className="list-inside list-disc text-sm text-charcoal-300">
              {(billing.plan.features ?? []).map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            {billing.renewsAt ? (
              <p className="text-xs text-charcoal-500">Renews {billing.renewsAt}</p>
            ) : null}
          </>
        ) : null}
      </GlassPanel>

      {billing?.sandboxActions && billing.sandboxActions.length > 0 ? (
        <GlassPanel className="space-y-3 p-6" data-testid="billing-sandbox-actions">
          <h2 className="font-display text-lg font-semibold">Sandbox upgrades</h2>
          <p className="text-sm text-charcoal-400">
            These actions are returned by the API for sandbox/testing only — not live charges.
          </p>
          <div className="flex flex-wrap gap-2">
            {billing.sandboxActions.map((action) => (
              <Button
                key={action.id}
                variant="secondary"
                onClick={() =>
                  void getApiClient()
                    .runSandboxBillingAction(action.id)
                    .then(() => qc.invalidateQueries({ queryKey: ["billing"] }))
                }
              >
                {action.label}
              </Button>
            ))}
          </div>
        </GlassPanel>
      ) : null}
    </div>
  );
}
