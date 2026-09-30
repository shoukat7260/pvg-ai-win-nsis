import { useEffect } from "react";
import { useAuthStore } from "@/auth/authStore";
import { LoginScreen } from "./LoginScreen";
import { SignupScreen } from "./SignupScreen";
import { WaitingForSignIn } from "./WaitingForSignIn";
import { MfaChallengeScreen } from "./MfaChallengeScreen";

/**
 * Auth gate: UNKNOWN → bootstrap; then login / signup / MFA / waiting / authenticated outlet.
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
        className="pvg-auth"
        data-testid="auth-bootstrapping"
        style={{ color: "var(--pvg-text-muted)", fontSize: 13 }}
      >
        Restoring session…
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
  if (view === "signup") {
    return <SignupScreen />;
  }

  return <LoginScreen />;
}
