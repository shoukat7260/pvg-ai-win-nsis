import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "@/auth/authStore";

export function AuthBootstrap({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);

  useEffect(() => {
    if (status === "UNKNOWN") void bootstrap();
  }, [status, bootstrap]);

  if (status === "UNKNOWN" || status === "AUTHENTICATING") {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm text-charcoal-400"
        data-testid="auth-bootstrapping"
      >
        Loading…
      </div>
    );
  }

  return <>{children}</>;
}

/** Blocks private routes until AUTHENTICATED — no flash of dashboard content. */
export function ProtectedRoute() {
  const status = useAuthStore((s) => s.status);
  const location = useLocation();

  if (status === "UNKNOWN" || status === "AUTHENTICATING") {
    return (
      <div
        className="flex min-h-screen items-center justify-center text-sm text-charcoal-400"
        data-testid="auth-bootstrapping"
      >
        Loading…
      </div>
    );
  }

  if (status !== "AUTHENTICATED") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}
