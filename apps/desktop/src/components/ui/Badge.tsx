import type { PropsWithChildren } from "react";

export function Badge({
  children,
  tone = "muted",
}: PropsWithChildren<{ tone?: "muted" | "accent" | "warn" }>) {
  const tones = {
    muted: "bg-white/5 text-charcoal-300 border-white/10",
    accent: "bg-accent-mute text-accent-bright border-accent/20",
    warn: "bg-warn-mute text-warn border-warn/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
