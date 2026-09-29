import { useState } from "react";
import { Button, Badge, EmptyState } from "@pvg/ui";
import { useAuthStore } from "@/auth/authStore";
import { getApiClient } from "@/auth/api";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  PROVIDER_DISPLAY_NAMES,
  PROVIDER_TYPES,
  type ProviderType,
} from "@pvg/types";

function formatWhen(value?: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

export function SettingsAccountPage() {
  const user = useAuthStore((s) => s.user);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div data-testid="settings-account">
      <div className="studio-page-head">
        <div>
          <h2>Account</h2>
          <p>Profile identity for the PVG cloud shell.</p>
        </div>
      </div>

      <section className="studio-card space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="accent">{user?.status?.replaceAll("_", " ") ?? "unknown"}</Badge>
          <Badge>{user?.emailVerified ? "email verified" : "email pending"}</Badge>
        </div>
        <p className="text-sm text-[var(--studio-muted)]">{user?.email}</p>
        <label className="block text-xs font-semibold uppercase tracking-[0.06em] text-[var(--studio-muted)]">
          Display name
          <input
            className="mt-1.5 w-full rounded-xl border px-3 py-2.5 text-sm font-medium"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            onClick={() =>
              void getApiClient()
                .updateMe({ displayName })
                .then(() => setMsg("Saved"))
                .catch((e: Error) => setMsg(e.message))
            }
          >
            Save changes
          </Button>
          {msg ? <p className="text-sm text-[var(--studio-muted)]">{msg}</p> : null}
        </div>
      </section>
    </div>
  );
}

export function SettingsSecurityPage() {
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => getApiClient().listSessions(),
    retry: false,
  });
  const activity = useQuery({
    queryKey: ["security-activity"],
    queryFn: () => getApiClient().listSecurityActivity(),
    retry: false,
  });
  const qc = useQueryClient();

  return (
    <div data-testid="settings-security" className="space-y-4">
      <div className="studio-page-head">
        <div>
          <h2>Security</h2>
          <p>Sessions and account activity across the PVG surface.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            void getApiClient()
              .revokeOtherSessions()
              .then(() => qc.invalidateQueries({ queryKey: ["sessions"] }))
          }
        >
          Revoke other sessions
        </Button>
      </div>

      <section className="studio-card">
        <h3 className="studio-card__title">Active sessions</h3>
        <ul className="studio-list">
          {(sessions.data ?? []).map((s) => (
            <li key={s.id}>
              <div className="studio-list__meta">
                <p className="studio-list__title">
                  {s.deviceName ?? s.createdFrom ?? s.id.slice(0, 8)}
                  {s.current ? " · current" : ""}
                </p>
                <p className="studio-list__sub">
                  {s.ip ?? "ip unknown"} · last seen {formatWhen(s.lastSeenAt)}
                </p>
              </div>
              {!s.current ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void getApiClient()
                      .revokeSession(s.id)
                      .then(() => qc.invalidateQueries({ queryKey: ["sessions"] }))
                  }
                >
                  Revoke
                </Button>
              ) : (
                <Badge tone="accent">current</Badge>
              )}
            </li>
          ))}
          {!sessions.isLoading && !sessions.data?.length ? (
            <EmptyState
              title="No sessions loaded"
              description="Sign in again to create a tracked session."
            />
          ) : null}
        </ul>
      </section>

      <section className="studio-card">
        <h3 className="studio-card__title">Security activity</h3>
        <ul className="studio-list">
          {(activity.data ?? []).map((a) => (
            <li key={a.id}>
              <div className="studio-list__meta">
                <p className="studio-list__title">{a.summary || a.eventType}</p>
                <p className="studio-list__sub">
                  {a.eventType} · {formatWhen(a.createdAt)}
                  {a.ip ? ` · ${a.ip}` : ""}
                </p>
              </div>
            </li>
          ))}
          {!activity.isLoading && !activity.data?.length ? (
            <EmptyState
              title="No recent events"
              description="Authentication and security events will appear here."
            />
          ) : null}
        </ul>
      </section>
    </div>
  );
}

export function SettingsDevicesPage() {
  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: () => getApiClient().listDevices(),
    retry: false,
  });
  const qc = useQueryClient();

  return (
    <div data-testid="settings-devices">
      <div className="studio-page-head">
        <div>
          <h2>Devices</h2>
          <p>Browsers and workstations linked to this account.</p>
        </div>
      </div>

      <section className="studio-card">
        {devices.isLoading ? (
          <p className="text-sm text-[var(--studio-muted)]">Loading devices…</p>
        ) : null}
        <ul className="studio-list">
          {(devices.data ?? []).map((d) => (
            <li key={d.id}>
              <div className="studio-list__meta">
                <p className="studio-list__title">
                  {d.name}
                  {d.current ? " · this device" : ""}
                </p>
                <p className="studio-list__sub">
                  {d.platform}
                  {d.trusted ? " · trusted" : ""}
                  {" · "}
                  last seen {formatWhen(d.lastSeenAt)}
                  {d.lastIp ? ` · ${d.lastIp}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={d.trusted ? "accent" : "neutral"}>
                  {d.trusted ? "trusted" : "standard"}
                </Badge>
                {!d.current ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      void getApiClient()
                        .revokeDevice(d.id)
                        .then(() => qc.invalidateQueries({ queryKey: ["devices"] }))
                    }
                  >
                    Revoke
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {!devices.isLoading && !devices.data?.length ? (
          <EmptyState
            title="No devices yet"
            description="Sign in from this browser or the desktop app to register a device."
          />
        ) : null}
      </section>
    </div>
  );
}

export function SettingsConnectionsPage() {
  const connections = useQuery({
    queryKey: ["connections"],
    queryFn: () => getApiClient().listConnections(),
    retry: false,
  });

  const cards = PROVIDER_TYPES.filter((p) => p !== "other") as ProviderType[];
  const byType = new Map((connections.data ?? []).map((c) => [c.providerType, c]));
  const anyConnected = (connections.data ?? []).some((c) => c.status === "connected");

  return (
    <div data-testid="settings-connections" className="space-y-4">
      <div className="studio-page-head">
        <div>
          <h2>Connections</h2>
          <p>
            Provider secrets stay device-scoped in the desktop vault. Web shows
            metadata only.
          </p>
        </div>
      </div>

      {!anyConnected && !connections.isLoading ? (
        <section className="studio-card">
          <EmptyState
            title="No providers connected"
            description="Connect from the PVG desktop app so keys never leave the OS vault."
          />
        </section>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((provider) => {
          const c = byType.get(provider);
          return (
            <article
              key={provider}
              className="studio-card"
              data-testid={`provider-card-${provider}`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="studio-card__title">{PROVIDER_DISPLAY_NAMES[provider]}</h3>
                <Badge tone={c?.status === "connected" ? "accent" : "neutral"}>
                  {c?.status ?? "disconnected"}
                </Badge>
              </div>
              <p className="studio-card__body mt-2">
                {c?.secretHint
                  ? `Hint ${c.secretHint}`
                  : "Connect on desktop for device keys."}
              </p>
            </article>
          );
        })}
      </div>
    </div>
  );
}

export function SettingsBillingPage() {
  const billing = useQuery({
    queryKey: ["billing"],
    queryFn: () => getApiClient().getBilling(),
    retry: false,
  });
  const qc = useQueryClient();
  const data = billing.data;

  return (
    <div data-testid="settings-billing">
      <div className="studio-page-head">
        <div>
          <h2>Billing</h2>
          <p>Sandbox plan controls — no fake live payment claims.</p>
        </div>
      </div>

      <section className="studio-card space-y-4">
        {billing.isLoading ? (
          <p className="text-sm text-[var(--studio-muted)]">Loading billing…</p>
        ) : null}
        {billing.isError ? (
          <p data-testid="billing-unavailable" className="text-sm text-[var(--studio-muted)]">
            Billing unavailable until the API responds. No fake live payments.
          </p>
        ) : null}
        {data?.plan ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <p
                className="font-display text-2xl font-semibold tracking-tight"
                data-testid="billing-plan-name"
              >
                {data.plan.name}
              </p>
              <Badge tone="accent">{data.plan.tier}</Badge>
              <Badge>{data.status}</Badge>
            </div>
            {data.renewsAt ? (
              <p className="text-sm text-[var(--studio-muted)]">
                Renews / period end · {formatWhen(data.renewsAt)}
              </p>
            ) : null}
            <ul className="grid gap-2 text-sm text-[var(--studio-muted)] md:grid-cols-2">
              {(data.plan.features ?? []).map((f) => (
                <li
                  key={f}
                  className="rounded-xl border border-[var(--studio-line)] bg-[#fafafa] px-3 py-2"
                >
                  {f}
                </li>
              ))}
            </ul>
            {data.sandboxActions?.length ? (
              <div data-testid="billing-sandbox-actions" className="flex flex-wrap gap-2 pt-1">
                {data.sandboxActions.map((a) => (
                  <Button
                    key={a.id}
                    variant="secondary"
                    size="sm"
                    onClick={() =>
                      void getApiClient()
                        .runSandboxBillingAction(a.id)
                        .then(() => qc.invalidateQueries({ queryKey: ["billing"] }))
                    }
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </div>
  );
}
