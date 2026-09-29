import type { PropsWithChildren, HTMLAttributes } from "react";

export function GlassPanel({
  children,
  className = "",
  ...rest
}: PropsWithChildren<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div
      className={`rounded-surface border border-white/[0.07] bg-white/[0.035] shadow-glass backdrop-blur-glass ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}
