import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export function SplashScreen() {
  const navigate = useNavigate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      navigate("/app/home", { replace: true });
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-charcoal-950"
      data-testid="splash-screen"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(ellipse at 50% 35%, rgba(91,164,160,0.16), transparent 50%), linear-gradient(160deg, #0B0C0E 0%, #16181C 45%, #0B0C0E 100%)",
        }}
      />
      <div className="relative z-10 text-center animate-fade-rise">
        <p className="font-display text-5xl font-semibold tracking-tight text-charcoal-100">
          PVG AI
        </p>
        <p className="mt-3 text-sm tracking-[0.22em] text-charcoal-400 uppercase">
          Product Generator AI
        </p>
        <div className="mx-auto mt-10 h-px w-24 bg-gradient-to-r from-transparent via-accent/70 to-transparent animate-soft-pulse" />
        <p className="mt-6 text-xs text-charcoal-500">Starting…</p>
      </div>
    </div>
  );
}
