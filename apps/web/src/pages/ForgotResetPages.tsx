import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Button } from "@pvg/ui";
import {
  ForgotPasswordRequestSchema,
  ResetPasswordRequestSchema,
  scorePasswordStrength,
} from "@pvg/schemas";
import { getApiClient } from "@/auth/api";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = ForgotPasswordRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid email");
      return;
    }
    setError(null);
    try {
      const res = await getApiClient().forgotPassword({ email });
      setMessage(res.message ?? "If an account exists, reset instructions were sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    }
  }

  return (
    <section className="auth-split">
      <aside className="auth-split__brand">
        <p className="auth-split__meta">Account recovery</p>
        <div>
          <h2>Reset access securely.</h2>
          <p>We email a one-time link when the account exists. No password leaks.</p>
        </div>
        <p className="auth-split__meta">Console transport in development</p>
      </aside>
      <div className="auth-split__form">
        <div className="auth-card">
          <h1>Forgot password</h1>
          <form className="mt-2" onSubmit={(e) => void onSubmit(e)}>
            <label className="auth-field">
              Email
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            {error ? <p className="auth-error">{error}</p> : null}
            {message ? <p className="auth-hint">{message}</p> : null}
            <Button type="submit" className="mt-4 w-full">
              Send reset link
            </Button>
          </form>
          <p className="auth-footer">
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    </section>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const strength = scorePasswordStrength(password);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = ResetPasswordRequestSchema.safeParse({ token, newPassword: password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    try {
      const res = await getApiClient().resetPassword({ token, newPassword: password });
      setMessage(res.message ?? "Password updated. You can sign in.");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed");
    }
  }

  return (
    <section className="auth-split">
      <aside className="auth-split__brand">
        <p className="auth-split__meta">New password</p>
        <div>
          <h2>Choose a stronger credential.</h2>
          <p>Use at least 10 characters. The server enforces the same policy.</p>
        </div>
        <p className="auth-split__meta">Strength: {strength.label}</p>
      </aside>
      <div className="auth-split__form">
        <div className="auth-card">
          <h1>Reset password</h1>
          <form className="mt-2" onSubmit={(e) => void onSubmit(e)}>
            <label className="auth-field">
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={10}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <p className="auth-hint">Strength: {strength.label} · minimum 10 characters</p>
            {error ? <p className="auth-error">{error}</p> : null}
            {message ? <p className="auth-hint">{message}</p> : null}
            <Button type="submit" className="mt-4 w-full">
              Update password
            </Button>
          </form>
          <p className="auth-footer">
            <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </div>
    </section>
  );
}
