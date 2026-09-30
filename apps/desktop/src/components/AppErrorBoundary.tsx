import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  diagId: string | null;
}

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, diagId: null };

  static getDerivedStateFromError(): Partial<State> {
    return {
      hasError: true,
      diagId: `pvg-${Date.now().toString(36)}`,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[PVG AppErrorBoundary]", this.state.diagId, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="pvg-auth" data-testid="app-error-boundary">
          <div className="pvg-auth-card" style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 18 }}>Something went wrong</h1>
            <p className="pvg-auth-card__lead">
              {this.props.fallbackTitle ?? "Reload the workspace to continue. Local projects are safe."}
            </p>
            {this.state.diagId ? (
              <p style={{ fontSize: 11, color: "var(--pvg-text-muted)" }}>
                Diagnostic: {this.state.diagId}
              </p>
            ) : null}
            <button
              type="button"
              className="pvg-btn pvg-btn--primary"
              style={{ marginTop: 16, width: "100%" }}
              onClick={() => window.location.assign("/app/home")}
            >
              Reload workspace
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
