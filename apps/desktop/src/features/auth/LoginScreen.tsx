import { useState, type FormEvent } from "react";
import { LoginRequestSchema } from "@pvg/schemas";
import { useAuthStore } from "@/auth/authStore";
import { desktopApiConfig } from "@/config/desktopApiConfig";

function BrandMark() {
  return (
    <span className="pvg-sidebar__mark" aria-hidden>
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
        <path d="M3.5 18.5 12 5l8.5 13.5H3.5Z" fill="#E8F7FF" fillOpacity="0.95" />
        <path d="M8.2 18.5 12 11.2 15.8 18.5H8.2Z" fill="#0B1F3A" fillOpacity="0.55" />
        <rect x="7" y="19.2" width="10" height="1.4" rx="0.7" fill="#1EC8FF" />
      </svg>
    </span>
  );
}

export function LoginScreen() {
  const loginWithPassword = useAuthStore((s) => s.loginWithPassword);
  const startBrowserLogin = useAuthStore((s) => s.startBrowserLogin);
  const setView = useAuthStore((s) => s.setView);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const info = useAuthStore((s) => s.info);
  const clearError = useAuthStore((s) => s.clearError);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const busy = status === "AUTHENTICATING";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    const parsed = LoginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? "Invalid credentials");
      return;
    }
    setClientError(null);
    await loginWithPassword(email.trim(), password);
  }

  return (
    <div className="pvg-auth" data-theme="studio-auth">
      <div className="pvg-auth-card" data-testid="login-screen">
        <div className="pvg-auth-card__brand">
          <BrandMark />
          <strong>PVG AI</strong>
        </div>
        <h1>Sign in</h1>
        <p className="pvg-auth-card__lead">
          Local-first studio. Cloud identity unlocks account, devices, and billing.
        </p>

        {status === "SESSION_EXPIRED" ? (
          <p className="pvg-auth-info" style={{ marginTop: 12 }}>
            Your session expired. Sign in again — local projects are unchanged.
          </p>
        ) : null}

        <form className="pvg-auth-form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <label>
            <span className="pvg-field-label">Email</span>
            <input
              className="pvg-input"
              name="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="login-email"
            />
          </label>
          <label>
            <span className="pvg-field-label">Password</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="pvg-input"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="login-password"
              />
              <button
                type="button"
                className="pvg-btn pvg-btn--ghost"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          {(clientError || error) && (
            <p className="pvg-auth-error" role="alert" data-testid="login-error">
              {clientError || error}
            </p>
          )}
          {info && !error ? <p className="pvg-auth-info">{info}</p> : null}

          <button
            type="submit"
            className="pvg-btn pvg-btn--primary pvg-btn--lg"
            style={{ width: "100%" }}
            disabled={busy}
            data-testid="login-submit"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="pvg-auth-footer" style={{ marginTop: 12 }}>
          <a
            href={`${desktopApiConfig.webOrigin}/forgot-password`}
            target="_blank"
            rel="noreferrer"
            data-testid="forgot-password-link"
          >
            Forgot password?
          </a>
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            margin: "16px 0",
            color: "var(--pvg-text-muted)",
            fontSize: 12,
          }}
        >
          <span style={{ flex: 1, height: 1, background: "var(--pvg-border)" }} />
          or
          <span style={{ flex: 1, height: 1, background: "var(--pvg-border)" }} />
        </div>

        <button
          type="button"
          className="pvg-btn pvg-btn--ghost"
          style={{ width: "100%" }}
          disabled={busy}
          onClick={() => void startBrowserLogin()}
          data-testid="continue-browser"
        >
          Continue in browser
        </button>

        <p className="pvg-auth-footer">
          No account yet?{" "}
          <button type="button" onClick={() => setView("signup")} data-testid="create-account-link">
            Create account
          </button>
        </p>
      </div>
    </div>
  );
}
