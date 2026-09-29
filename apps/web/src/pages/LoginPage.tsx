import { useState, type FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Button } from "@pvg/ui";
import { LoginRequestSchema } from "@pvg/schemas";
import { useAuthStore } from "@/auth/authStore";
import type { MfaMethodKind } from "@pvg/types";

export function LoginPage() {
  const login = useAuthStore((s) => s.login);
  const submitMfa = useAuthStore((s) => s.submitMfa);
  const mfaChallengeId = useAuthStore((s) => s.mfaChallengeId);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [clientError, setClientError] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const [mfaMethod, setMfaMethod] = useState<MfaMethodKind>("totp");

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    clearError();
    const parsed = LoginRequestSchema.safeParse({ email, password });
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    setClientError(null);
    try {
      const result = await login(email.trim(), password);
      if (result === "ok") navigate(from, { replace: true });
    } catch {
      /* error in store */
    }
  }

  async function onMfa(e: FormEvent) {
    e.preventDefault();
    await submitMfa(mfaMethod, mfaCode);
    navigate(from, { replace: true });
  }

  return (
    <section className="auth-split">
      <aside className="auth-split__brand">
        <p className="auth-split__meta">PVG workspace</p>
        <div>
          <h2>Sign in to your cloud console.</h2>
          <p>
            Manage account, devices, security, and billing. Editing stays on the
            local-first desktop workstation.
          </p>
        </div>
        <p className="auth-split__meta">Black · white · local-first</p>
      </aside>

      <div className="auth-split__form">
        <div className="auth-card" data-testid="login-form">
          {mfaChallengeId ? (
            <>
              <h1>Verify identity</h1>
              <p className="auth-card__lead">Enter your MFA code to continue.</p>
              <form className="mt-2" onSubmit={(e) => void onMfa(e)} noValidate>
                <label className="auth-field">
                  Method
                  <select
                    className="mt-1.5 w-full rounded-xl border border-[#d4d4d4] bg-white px-3 py-2.5 text-sm"
                    value={mfaMethod}
                    onChange={(e) => setMfaMethod(e.target.value as MfaMethodKind)}
                  >
                    <option value="totp">Authenticator</option>
                    <option value="recovery_code">Recovery code</option>
                  </select>
                </label>
                <label className="auth-field">
                  Code
                  <input
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value)}
                    autoComplete="one-time-code"
                    required
                  />
                </label>
                {(clientError || error) && (
                  <p className="auth-error" role="alert">
                    {clientError || error}
                  </p>
                )}
                <Button type="submit" className="mt-4 w-full">
                  Continue
                </Button>
              </form>
            </>
          ) : (
            <>
              <h1>Sign in</h1>
              <p className="auth-card__lead">Access your PVG account on the web.</p>
              <form className="mt-2" onSubmit={(e) => void onSubmit(e)} noValidate>
                <label className="auth-field">
                  Email
                  <input
                    name="email"
                    type="email"
                    autoComplete="username"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="login-email"
                  />
                </label>
                <label className="auth-field">
                  Password
                  <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="login-password"
                  />
                </label>
                {(clientError || error) && (
                  <p className="auth-error" role="alert" data-testid="login-error">
                    {clientError || error}
                  </p>
                )}
                <Button type="submit" className="mt-4 w-full" data-testid="login-submit">
                  Sign in
                </Button>
              </form>
              <p className="auth-footer">
                <Link to="/forgot-password">Forgot password?</Link>
                {" · "}
                <Link to="/signup">Create account</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
