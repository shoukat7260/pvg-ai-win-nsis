import { Badge } from "@pvg/ui";

const PLANS = [
  { tier: "FREE", name: "Free", blurb: "Account + local desktop foundation." },
  { tier: "CREATOR", name: "Creator", blurb: "Sandbox upgrades for solo makers." },
  { tier: "PRO", name: "Pro", blurb: "Higher entitlements when billing lands." },
  { tier: "AGENCY", name: "Agency", blurb: "Team-ready entitlements (later)." },
] as const;

export function PricingPage() {
  return (
    <section className="public-pricing">
      <p className="app-shell__eyebrow" style={{ color: "#737373" }}>
        Plans
      </p>
      <h1
        className="font-display text-3xl font-semibold tracking-tight"
        style={{ color: "#0a0a0a" }}
      >
        Pricing
      </h1>
      <p className="mt-2 max-w-xl text-sm" style={{ color: "#737373" }}>
        Plans are data-driven from the API. Live payment checkout is not simulated here.
      </p>
      <div className="public-pricing__grid">
        {PLANS.map((p) => (
          <article key={p.tier} className="public-pricing__card">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold tracking-tight">{p.name}</h2>
              <Badge tone="accent">{p.tier}</Badge>
            </div>
            <p className="mt-2 text-sm" style={{ color: "#737373" }}>
              {p.blurb}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
