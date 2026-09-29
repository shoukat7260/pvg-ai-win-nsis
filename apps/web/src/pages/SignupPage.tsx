import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@pvg/ui";
import { SignupRequestSchema, scorePasswordStrength } from "@pvg/schemas";
import { useAuthStore } from "@/auth/authStore";

export function SignupPage() {
  const signup = useAuthStore((s) => s.signup);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const strength = scorePasswordStrength(password);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const parsed = SignupRequestSchema.safeParse({ email, password, displayName });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }
    setError(null);
    try {
      await signup(email.trim(), password, displayName.trim());
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    }
  }

  return (
    <section className="auth-split">
      <aside className="auth-split__brand">
        <p className="auth-split__meta">Create account</p>
        <div>
          <h2>Start with a branded workspace shell.</h2>
          <p>
            Passwords need at least 10 characters. After signup you can sign in and
            manage devices from the console.
          </p>
        </div>
        <p className="auth-split__meta">Server enforces policy</p>
      </aside>

      <div className="auth-split__form">
        {done ? (
          <div className="auth-card" data-testid="signup-success">
            <h1>Check your email</h1>
            <p className="auth-card__lead">
              We sent a verification link if the address can receive mail. You can sign
              in after creating the account.
            </p>
            <Button className="mt-4 w-full" onClick={() => navigate("/login")}>
              Go to sign in
            </Button>
          </div>
        ) : (
          <div className="auth-card" data-testid="signup-form">
            <h1>Create account</h1>
            <p className="auth-card__lead">
              Use a password with 10+ characters.
            </p>
            <form className="mt-2" onSubmit={(e) => void onSubmit(e)} noValidate>
              <label className="auth-field">
                Display name
                <input
                  name="name"
                  autoComplete="name"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  data-testid="signup-name"
                />
              </label>
              <label className="auth-field">
                Email
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="signup-email"
                />
              </label>
              <label className="auth-field">
                Password
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={10}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  data-testid="signup-password"
                />
              </label>
              <p className="auth-hint" data-testid="password-strength">
                Strength: {strength.label} · minimum 10 characters
              </p>
              {error ? (
                <p className="auth-error" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="mt-4 w-full" data-testid="signup-submit">
                Sign up
              </Button>
            </form>
            <p className="auth-footer">
              Already have an account? <Link to="/login">Sign in</Link>
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
