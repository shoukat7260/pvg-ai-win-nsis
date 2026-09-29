interface ErrorStateProps {
  title?: string;
  message: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}: ErrorStateProps) {
  return (
    <div
      className="rounded-surface border border-danger/30 bg-danger-mute px-5 py-4"
      data-testid="error-state"
      role="alert"
    >
      <h3 className="font-display text-base font-semibold text-danger">{title}</h3>
      <p className="mt-1 text-sm text-charcoal-200">{message}</p>
      {onRetry ? (
        <button
          type="button"
          className="mt-3 text-sm font-medium text-accent-bright underline-offset-2 hover:underline"
          onClick={onRetry}
        >
          Try again
        </button>
      ) : null}
    </div>
  );
}
