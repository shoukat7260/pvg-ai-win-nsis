import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "pvg.onboarding.v1";

const WORKFLOWS = [
  { id: "creator", label: "Creator", desc: "Short-form and social content" },
  { id: "business", label: "Business", desc: "Product and brand videos" },
  { id: "marketing", label: "Marketing", desc: "Ads, UGC, campaigns" },
  { id: "pro", label: "Professional", desc: "Timeline-first editing" },
] as const;

export function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [workflow, setWorkflow] = useState<string>("creator");

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "done") {
        navigate("/app/home", { replace: true });
      }
    } catch {
      // ignore
    }
  }, [navigate]);

  const finish = () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ done: true, workflow, at: new Date().toISOString() }),
      );
      localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      // ignore
    }
    navigate("/app/home?create=1", { replace: true });
  };

  const skip = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      // ignore
    }
    navigate("/app/home", { replace: true });
  };

  return (
    <div className="pvg-auth" data-testid="onboarding">
      <div className="pvg-auth-card" style={{ maxWidth: 480 }}>
        {step === 0 ? (
          <>
            <h1>Welcome to PVG AI</h1>
            <p className="pvg-auth-card__lead">
              Local-first creative workstation with a CapCut-class editor and AI workspace.
            </p>
            <button
              type="button"
              className="pvg-btn pvg-btn--primary pvg-btn--lg"
              style={{ width: "100%", marginTop: 16 }}
              onClick={() => setStep(1)}
            >
              Continue
            </button>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <h1>Choose default workflow</h1>
            <p className="pvg-auth-card__lead">You can change this later in Settings.</p>
            <div className="pvg-tool-row" style={{ marginTop: 16 }}>
              {WORKFLOWS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className="pvg-tool-card"
                  style={
                    workflow === w.id
                      ? { borderColor: "var(--pvg-accent)", background: "var(--pvg-accent-muted)" }
                      : undefined
                  }
                  onClick={() => setWorkflow(w.id)}
                >
                  <span className="pvg-tool-card__title">{w.label}</span>
                  <span className="pvg-tool-card__desc">{w.desc}</span>
                </button>
              ))}
            </div>
            <div className="pvg-modal__actions">
              <button type="button" className="pvg-btn pvg-btn--ghost" onClick={() => setStep(0)}>
                Back
              </button>
              <button type="button" className="pvg-btn pvg-btn--primary" onClick={() => setStep(2)}>
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1>Local storage</h1>
            <p className="pvg-auth-card__lead">
              Projects and media stay on this device under the PVG data root. You can change
              paths later in Settings → Storage when available.
            </p>
            <div className="pvg-modal__actions">
              <button type="button" className="pvg-btn pvg-btn--ghost" onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className="pvg-btn pvg-btn--primary" onClick={() => setStep(3)}>
                Continue
              </button>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1>Create your first project</h1>
            <p className="pvg-auth-card__lead">
              Provider connections are optional. You can connect AI providers from Settings
              anytime.
            </p>
            <div className="pvg-modal__actions">
              <button type="button" className="pvg-btn pvg-btn--ghost" onClick={skip}>
                Skip
              </button>
              <button
                type="button"
                className="pvg-btn pvg-btn--primary"
                onClick={finish}
                data-testid="onboarding-finish"
              >
                Create first project
              </button>
            </div>
          </>
        ) : null}

        {step < 3 ? (
          <p className="pvg-auth-footer">
            <button type="button" onClick={skip}>
              Skip onboarding
            </button>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function shouldShowOnboarding(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== "done";
  } catch {
    return false;
  }
}
