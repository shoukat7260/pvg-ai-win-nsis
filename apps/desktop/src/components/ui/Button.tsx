import type { ButtonHTMLAttributes, PropsWithChildren } from "react";

type Variant = "primary" | "ghost" | "danger" | "subtle" | "secondary";
type Size = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const styles: Record<Variant, string> = {
  primary:
    "bg-accent text-charcoal-950 hover:bg-accent-bright disabled:bg-charcoal-600 disabled:text-charcoal-400",
  secondary:
    "bg-white/5 text-charcoal-100 border border-white/15 hover:bg-white/10 disabled:text-charcoal-500",
  ghost:
    "bg-transparent text-charcoal-200 hover:bg-white/5 border border-white/10 disabled:text-charcoal-500",
  danger: "bg-danger-mute text-danger hover:bg-danger/20",
  subtle: "bg-white/5 text-charcoal-200 hover:bg-white/10",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2.5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...rest
}: PropsWithChildren<ButtonProps>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${styles[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
