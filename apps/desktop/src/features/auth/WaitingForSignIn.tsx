import { GlassPanel } from "@/components/ui/GlassPanel";
import { Button } from "@/components/ui/Button";
import { useAuthStore } from "@/auth/authStore";

export function WaitingForSignIn() {
  const cancelBrowserLogin = useAuthStore((s) => s.cancelBrowserLogin);
  const view = useAuthStore((s) => s.view);
  const error = useAuthStore((s) => s.error);
  const retryBrowserLogin = useAuthStore((s) => s.retryBrowserLogin);

  if (view === "browser_failed") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-charcoal-950 px-6">
        <GlassPanel className="w-full max-w-md p-8 animate-fade-rise" data-testid="browser-auth-failed">
          <p className="font-display text-xl font-semibold">Sign-in interrupted</p>
          <p className="mt-3 text-sm text-charcoal-300">
            {error ?? "Secure browser sign-in did not complete."}
          </p>
          <div className="mt-6 flex flex-col gap-3">
            <Button onClick={() => void retryBrowserLogin()} data-testid="browser-auth-retry">
              Try again
            </Button>
            <Button variant="ghost" onClick={cancelBrowserLogin}>
              Back to login
            </Button>
          </div>
        </GlassPanel>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-charcoal-950 px-6">
      <GlassPanel className="w-full max-w-md p-8 animate-fade-rise" data-testid="waiting-sign-in">
        <p className="font-display text-xl font-semibold">Waiting for secure sign-in…</p>
        <p className="mt-3 text-sm text-charcoal-400">
          Finish signing in in your browser. This window will continue automatically.
          Nothing sensitive is displayed here.
        </p>
        <div className="mx-auto mt-8 h-1 w-32 animate-soft-pulse rounded-full bg-accent/60" />
        <Button
          variant="ghost"
          className="mt-8 w-full"
          onClick={cancelBrowserLogin}
          data-testid="cancel-browser-auth"
        >
          Cancel
        </Button>
      </GlassPanel>
    </div>
  );
}
