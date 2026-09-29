import type { HTMLAttributes, ReactNode } from "react";

export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  description?: string;
  action?: ReactNode;
}

function cx(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function EmptyState({
  title,
  description,
  action,
  className,
  ...rest
}: EmptyStateProps) {
  return (
    <div className={cx("pvg-empty", className)} {...rest}>
      <h3 className="pvg-empty__title">{title}</h3>
      {description ? (
        <p className="pvg-empty__description">{description}</p>
      ) : null}
      {action ? <div className="pvg-empty__actions">{action}</div> : null}
    </div>
  );
}
