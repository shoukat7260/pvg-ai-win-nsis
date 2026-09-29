import { useEffect } from "react";
import { useAuthStore } from "@/auth/authStore";
import { LoginScreen } from "./LoginScreen";
import { WaitingForSignIn } from "./WaitingForSignIn";
import { MfaChallengeScreen } from "./MfaChallengeScreen";

/**
 * Auth gate: UNKNOWN → bootstrap; then login / MFA / waiting / authenticated outlet.
 * Never flash private content before auth status resolves.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const view = useAuthStore((s) => s.view);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    if (status === "UNKNOWN") {
      void bootstrap();
    }
  }, [status, bootstrap]);

  if (status === "UNKNOWN") {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-charcoal-950 text-sm text-charcoal-400"
        data-testid="auth-bootstrapping"
      >
        Checking session…
      </div>
    );
  }

  if (status === "AUTHENTICATED") {
    return <>{children}</>;
  }

  if (view === "mfa") {
    return <MfaChallengeScreen />;
  }
  if (view === "waiting_browser" || view === "browser_failed") {
    return <WaitingForSignIn />;
  }

  return <LoginScreen />;
}
