import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/auth/authStore";
import { useState, type FormEvent } from "react";
import { LoginRequestSchema } from "@pvg/schemas";

export function LoginScreen() {
  const loginWithPassword = useAuthStore((s) => s.loginWithPassword);
  const startBrowserLogin = useAuthStore((s) => s.startBrowserLogin);
  const status = useAuthStore((s) => s.status);
  const error = useAuthStore((s) => s.error);
  const clearError = useAuthStore((s) => s.clearError);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div
      className="flex min-h-screen bg-[#f7f7f5] text-[#0a0a0a]"
      data-theme="studio-auth"
    >
      <aside className="hidden w-[42%] flex-col justify-between bg-[#0a0a0a] px-10 py-12 text-[#f5f5f5] md:flex">
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-white text-[#0a0a0a]">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
              <path
                d="M4 16.5 12 4l8 12.5H4Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path d="M8.2 16.5h7.6" stroke="currentColor" strokeWidth="1.7" />
            </svg>
          </span>
          <p className="font-display text-lg font-semibold tracking-tight">PVG AI</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
            Workstation
          </p>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">
            Sign in to your local-first studio.
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#a3a3a3]">
            Desktop keeps media on device. Cloud identity unlocks account, devices, and
            billing — CapCut focus with Stripe clarity.
          </p>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#737373]">
          Black · white · vault-backed
        </p>
      </aside>

      <div className="flex flex-1 items-center justify-center px-6 py-10">
        <GlassPanel
          className="w-full max-w-md border border-[#e8e8e8] bg-white p-8 shadow-[0_18px_40px_rgba(10,10,10,0.06)] animate-fade-rise"
          data-testid="login-screen"
        >
          <p className="font-display text-2xl font-semibold tracking-tight md:hidden">
            PVG AI
          </p>
          <p className="font-display text-2xl font-semibold tracking-tight">Sign in</p>
          <p className="mt-1 text-sm text-[#737373]">Access your workstation console</p>

          {status === "SESSION_EXPIRED" ? (
            <p className="mt-4 rounded-xl border border-[#e8e8e8] bg-[#fafafa] px-4 py-3 text-sm text-[#525252]">
              Your session expired. Sign in again to continue. Local projects are unchanged.
            </p>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={(e) => void onSubmit(e)} noValidate>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#737373]">
              Email
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#d4d4d4] bg-white px-3 py-2.5 text-sm text-[#0a0a0a]"
                data-testid="login-email"
              />
            </label>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#737373]">
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-[#d4d4d4] bg-white px-3 py-2.5 text-sm text-[#0a0a0a]"
                data-testid="login-password"
              />
            </label>

            {(clientError || error) && (
              <p className="text-sm text-[#b42318]" role="alert" data-testid="login-error">
                {clientError || error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full !bg-[#0a0a0a] !text-white hover:!bg-[#262626]"
              disabled={busy}
              data-testid="login-submit"
            >
              {busy ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3 text-xs text-[#a3a3a3]">
            <span className="h-px flex-1 bg-[#e8e8e8]" />
            or
            <span className="h-px flex-1 bg-[#e8e8e8]" />
          </div>

          <Button
            variant="secondary"
            className="w-full !border-[#d4d4d4] !bg-white !text-[#0a0a0a]"
            disabled={busy}
            onClick={() => void startBrowserLogin()}
            data-testid="continue-browser"
          >
            Continue in browser
          </Button>
          <p className="mt-3 text-center text-xs text-[#737373]">
            Opens a secure browser window. Tokens are never shown in the UI.
          </p>
          <p className="mt-4 text-center text-xs text-[#737373]">
            No account yet?{" "}
            <a
              href="http://localhost:5173/signup"
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-[#0a0a0a] underline-offset-2 hover:underline"
              data-testid="create-account-link"
            >
              Create account
            </a>
          </p>
        </GlassPanel>
      </div>
    </div>
  );
}
