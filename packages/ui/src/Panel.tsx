import type { HTMLAttributes, ReactNode } from "react";

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  children?: ReactNode;
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function Panel({ title, children, className, ...rest }: PanelProps) {
  return (
    <section className={cx("pvg-panel", className)} {...rest}>
      {title ? <h2 className="pvg-panel__title">{title}</h2> : null}
      <div className="pvg-panel__body">{children}</div>
    </section>
  );
}
