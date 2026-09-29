import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { getApiClient } from "@/auth/api";
import { vaultService } from "@/services/vault";
import { PROVIDER_DISPLAY_NAMES, PROVIDER_TYPES, type ProviderType } from "@pvg/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const CARD_PROVIDERS = PROVIDER_TYPES.filter((p) => p !== "other") as ProviderType[];

function hintFromSecret(secret: string): string {
  const trimmed = secret.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

export function ConnectionsSettings() {
  const qc = useQueryClient();
  const connectionsQuery = useQuery({
    queryKey: ["connections"],
    queryFn: () => getApiClient().listConnections(),
    retry: false,
  });
  const [draftSecrets, setDraftSecrets] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  const byProvider = new Map(
    (connectionsQuery.data ?? []).map((c) => [c.providerType, c]),
  );

  async function connect(provider: ProviderType) {
    const secret = draftSecrets[provider]?.trim();
    if (!secret) {
      setMessage("Enter an API key to connect. It stays on this device.");
      return;
    }
    setMessage(null);
    try {
      await vaultService.saveProviderCredential(provider, secret);
      await getApiClient().connectProvider({
        providerType: provider,
        displayName: PROVIDER_DISPLAY_NAMES[provider],
        method: "API_KEY",
        credentialRef: `provider.${provider}`,
        secretHint: hintFromSecret(secret),
      });
      setDraftSecrets((s) => ({ ...s, [provider]: "" }));
      void qc.invalidateQueries({ queryKey: ["connections"] });
      setMessage(`${PROVIDER_DISPLAY_NAMES[provider]} connected on this device.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Connect failed");
    }
  }

  async function disconnect(provider: ProviderType, connectionId?: string) {
    try {
      await vaultService.deleteProviderCredential(provider);
      if (connectionId) {
        await getApiClient().disconnectConnection(connectionId);
      }
      void qc.invalidateQueries({ queryKey: ["connections"] });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Disconnect failed");
    }
  }

  const empty =
    !connectionsQuery.isLoading &&
    !(connectionsQuery.data?.some((c) => c.status === "connected"));

  return (
    <div className="space-y-6" data-testid="settings-connections">
      <p className="text-sm text-charcoal-400">
        Provider API keys are <strong className="font-medium text-charcoal-200">device-scoped</strong>.
        Connecting on this machine does not copy secrets to other devices. Full secrets are never
        shown after save — only a short hint.
      </p>

      {empty ? (
        <EmptyState
          title="No providers connected"
          description="Add a key below to connect ElevenLabs, Google, Runway, Kling, fal.ai, or OpenRouter on this device."
        />
      ) : null}

      <div className="grid gap-4">
        {CARD_PROVIDERS.map((provider) => {
          const conn = byProvider.get(provider);
          const connected = conn?.status === "connected";
          return (
            <GlassPanel key={provider} className="space-y-3 p-5" data-testid={`provider-card-${provider}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="font-display text-base font-semibold">
                    {PROVIDER_DISPLAY_NAMES[provider]}
                  </h3>
                  <p className="text-xs text-charcoal-500">
                    {conn?.secretHint ? `Hint ${conn.secretHint}` : "Not connected on this device"}
                  </p>
                </div>
                <Badge tone={connected ? "accent" : "muted"}>
                  {conn?.status ?? "disconnected"}
                </Badge>
              </div>

              {!connected ? (
                <label className="block text-xs text-charcoal-400">
                  API key
                  <input
                    type="password"
                    autoComplete="off"
                    className="mt-1 pvg-input pvg-input--light font-mono"
                    value={draftSecrets[provider] ?? ""}
                    onChange={(e) =>
                      setDraftSecrets((s) => ({ ...s, [provider]: e.target.value }))
                    }
                    placeholder="Paste key — stored in OS vault"
                    data-testid={`provider-secret-${provider}`}
                  />
                </label>
              ) : null}

              <div className="flex flex-wrap gap-2">
                {!connected ? (
                  <Button size="sm" onClick={() => void connect(provider)}>
                    Connect
                  </Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        conn &&
                        void getApiClient()
                          .testConnection(conn.id)
                          .then(() => qc.invalidateQueries({ queryKey: ["connections"] }))
                          .catch((err: Error) => setMessage(err.message))
                      }
                    >
                      Test
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        conn &&
                        void getApiClient()
                          .refreshConnection(conn.id)
                          .then(() => qc.invalidateQueries({ queryKey: ["connections"] }))
                          .catch((err: Error) => setMessage(err.message))
                      }
                    >
                      Refresh
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => void disconnect(provider, conn?.id)}
                    >
                      Disconnect
                    </Button>
                  </>
                )}
              </div>
            </GlassPanel>
          );
        })}
      </div>
      {message ? <p className="text-sm text-charcoal-300">{message}</p> : null}
    </div>
  );
}
