import { useMemo, useState, type FormEvent } from "react";
import { SignupRequestSchema, scorePasswordStrength } from "@pvg/schemas";
import { useAuthStore } from "@/auth/authStore";

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

export function SignupScreen() {
  const signupWithPassword = useAuthStore((s) => s.signupWithPassword);
  const setView = useAuthStore((s) => s.setView);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const busy = status === "AUTHENTICATING";
  const strength = useMemo(() => scorePasswordStrength(password), [password]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    if (!acceptTerms) {
      setClientError("Please acknowledge the terms to continue.");
      return;
    }
    if (password !== confirm) {
      setClientError("Passwords do not match.");
      return;
    }
    const parsed = SignupRequestSchema.safeParse({
      email,
      password,
      displayName,
    });
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    setClientError(null);
    await signupWithPassword(email.trim(), password, displayName.trim());
  }

  return (
    <div className="pvg-auth">
      <div className="pvg-auth-card" data-testid="signup-screen">
        <div className="pvg-auth-card__brand">
          <BrandMark />
          <strong>PVG AI</strong>
        </div>
        <h1>Create your account</h1>
        <p className="pvg-auth-card__lead">
          Start your local-first creative workstation. Passwords need 10+ characters.
        </p>

        <form className="pvg-auth-form" onSubmit={(e) => void onSubmit(e)} noValidate>
          <label>
            <span className="pvg-field-label">Full name</span>
            <input
              className="pvg-input"
              name="name"
              autoComplete="name"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              data-testid="signup-name"
            />
          </label>
          <label>
            <span className="pvg-field-label">Email</span>
            <input
              className="pvg-input"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              data-testid="signup-email"
            />
          </label>
          <label>
            <span className="pvg-field-label">Password</span>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                className="pvg-input"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                data-testid="signup-password"
              />
              <button
                type="button"
                className="pvg-btn pvg-btn--ghost"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            <div className="pvg-strength" aria-hidden>
              <div
                className="pvg-strength__bar"
                style={{ width: `${Math.min(100, strength.score * 25)}%` }}
              />
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--pvg-text-muted)" }}>
              Strength: {strength.label}
            </p>
          </label>
          <label>
            <span className="pvg-field-label">Confirm password</span>
            <input
              className="pvg-input"
              name="confirm"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              data-testid="signup-confirm"
            />
          </label>
          <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12 }}>
            <input
              type="checkbox"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              data-testid="signup-terms"
            />
            <span>
              I agree to PVG AI Terms and acknowledge that media stays local unless I use cloud
              features.
            </span>
          </label>

          {(clientError || error) && (
            <p className="pvg-auth-error" role="alert" data-testid="signup-error">
              {clientError || error}
            </p>
          )}

          <button
            type="submit"
            className="pvg-btn pvg-btn--primary pvg-btn--lg"
            style={{ width: "100%" }}
            disabled={busy}
            data-testid="signup-submit"
          >
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="pvg-auth-footer">
          Already have an account?{" "}
          <button type="button" onClick={() => setView("login")} data-testid="signup-to-login">
            Sign in
          </button>
        </p>
      </div>
    </div>
  );
}
