interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-start gap-3 rounded-surface border border-dashed border-white/10 bg-charcoal-900/40 px-6 py-8"
      data-testid="empty-state"
    >
      <h3 className="font-display text-lg font-semibold text-charcoal-100">{title}</h3>
      <p className="max-w-md text-sm text-charcoal-300">{description}</p>
      {action}
    </div>
  );
}
