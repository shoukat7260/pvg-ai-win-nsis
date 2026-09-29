import { Link } from "react-router-dom";
import { Button } from "@pvg/ui";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/auth/authStore";
import { getApiClient } from "@/auth/api";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: () => getApiClient().listDevices(),
    retry: false,
  });
  const sessions = useQuery({
    queryKey: ["sessions"],
    queryFn: () => getApiClient().listSessions(),
    retry: false,
  });
  const billing = useQuery({
    queryKey: ["billing"],
    queryFn: () => getApiClient().getBilling(),
    retry: false,
  });
  const connections = useQuery({
    queryKey: ["connections"],
    queryFn: () => getApiClient().listConnections(),
    retry: false,
  });

  const deviceCount = devices.data?.length ?? 0;
  const sessionCount = sessions.data?.length ?? 0;
  const connectionCount =
    connections.data?.filter((c) => c.status === "connected").length ?? 0;
  const planName = billing.data?.plan?.name ?? "—";

  return (
    <div data-testid="dashboard" className="space-y-4">
      <section className="studio-hero">
        <div>
          <p className="app-shell__eyebrow">Studio overview</p>
          <h2 className="studio-hero__title">
            Welcome back, {user?.displayName ?? "creator"}
          </h2>
          <p className="studio-hero__copy">
            PVG AI keeps identity, devices, and billing in the cloud — the desktop
            remains your local-first workstation. This shell is built for control,
            not clutter.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/settings/devices">
            <Button>Manage devices</Button>
          </Link>
          <Link to="/settings/billing">
            <Button variant="secondary">View billing</Button>
          </Link>
        </div>
      </section>

      <section className="studio-metrics">
        <article className="studio-metric">
          <p className="studio-metric__label">Plan</p>
          <div>
            <p className="studio-metric__value">{planName}</p>
            <p className="studio-metric__hint">
              {billing.data?.status ?? "loading"} · sandbox-ready
            </p>
          </div>
        </article>
        <article className="studio-metric">
          <p className="studio-metric__label">Devices</p>
          <div>
            <p className="studio-metric__value">{deviceCount}</p>
            <p className="studio-metric__hint">Trusted workstations & browsers</p>
          </div>
        </article>
        <article className="studio-metric">
          <p className="studio-metric__label">Sessions</p>
          <div>
            <p className="studio-metric__value">{sessionCount}</p>
            <p className="studio-metric__hint">Active sign-ins across surfaces</p>
          </div>
        </article>
        <article className="studio-metric">
          <p className="studio-metric__label">Connections</p>
          <div>
            <p className="studio-metric__value">{connectionCount}</p>
            <p className="studio-metric__hint">Provider metadata only — no secrets</p>
          </div>
        </article>
      </section>

      <section className="studio-grid">
        <article className="studio-card">
          <h3 className="studio-card__title">Account pulse</h3>
          <p className="studio-card__body">
            {user?.email}
            {" · "}
            status {user?.status?.replaceAll("_", " ")}
            {user?.mfaEnabled ? " · MFA on" : " · MFA off"}
          </p>
          <ul className="studio-list">
            <li>
              <div className="studio-list__meta">
                <p className="studio-list__title">Security center</p>
                <p className="studio-list__sub">Sessions, MFA posture, recent events</p>
              </div>
              <Link to="/settings/security">
                <Button size="sm" variant="secondary">
                  Open
                </Button>
              </Link>
            </li>
            <li>
              <div className="studio-list__meta">
                <p className="studio-list__title">Provider connections</p>
                <p className="studio-list__sub">Connect keys from the desktop vault</p>
              </div>
              <Link to="/settings/connections">
                <Button size="sm" variant="secondary">
                  Open
                </Button>
              </Link>
            </li>
          </ul>
        </article>

        <article className="studio-card">
          <h3 className="studio-card__title">Workstation note</h3>
          <p className="studio-card__body">
            Editing, media, and generation stay on-device. Use this branded console to
            manage the account layer CapCut/Stripe-style — clean rail, white canvas,
            zero noise.
          </p>
          <div className="mt-5 rounded-xl border border-[var(--studio-line)] bg-[#fafafa] px-4 py-3 text-sm text-[var(--studio-muted)]">
            Tip: open PVG Desktop after signing in here to continue local projects.
          </div>
        </article>
      </section>
    </div>
  );
}
