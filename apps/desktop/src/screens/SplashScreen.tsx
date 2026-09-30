import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const PHASES = [
  "Initializing",
  "Loading workspace",
  "Restoring session",
] as const;

export function SplashScreen() {
  const navigate = useNavigate();
  const [phaseIdx, setPhaseIdx] = useState(0);

  useEffect(() => {
    const step = window.setInterval(() => {
      setPhaseIdx((i) => Math.min(i + 1, PHASES.length - 1));
    }, 350);
    const timer = window.setTimeout(() => {
      navigate("/app/home", { replace: true });
    }, 1100);
    return () => {
      window.clearInterval(step);
      window.clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <div className="pvg-auth" data-testid="splash-screen">
      <div style={{ textAlign: "center" }}>
        <span
          className="pvg-sidebar__mark"
          style={{ width: 48, height: 48, margin: "0 auto 16px", display: "grid" }}
          aria-hidden
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
            <path d="M3.5 18.5 12 5l8.5 13.5H3.5Z" fill="#E8F7FF" fillOpacity="0.95" />
            <path d="M8.2 18.5 12 11.2 15.8 18.5H8.2Z" fill="#0B1F3A" fillOpacity="0.55" />
            <rect x="7" y="19.2" width="10" height="1.4" rx="0.7" fill="#1EC8FF" />
          </svg>
        </span>
        <p style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em" }}>
          PVG AI
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--pvg-text-muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
          Product Video Generator AI
        </p>
        <p
          style={{ margin: "28px 0 0", fontSize: 13, color: "var(--pvg-text-secondary)" }}
          data-testid="splash-phase"
        >
          {PHASES[phaseIdx]}…
        </p>
      </div>
    </div>
  );
}
