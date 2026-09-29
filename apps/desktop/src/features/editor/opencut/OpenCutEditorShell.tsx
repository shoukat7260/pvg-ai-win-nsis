import { useEffect, useState, type ReactNode } from "react";
import {
  OPENCUT_PINNED_COMMIT,
  ensureOpenCutWasm,
  getOpenCutWasmStatus,
} from "@pvg/opencut-integration";

type InitState = "loading" | "ready" | "failed";

/**
 * PVG workspace shell around OpenCut-powered editor subsystems.
 * Does not run a separate OpenCut web app or iframe.
 */
export function OpenCutEditorShell({ children }: { children: ReactNode }) {
  const [state, setState] = useState<InitState>("loading");
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        await ensureOpenCutWasm();
        if (cancelled) return;
        setState("ready");
      } catch (e) {
        if (cancelled) return;
        setState("failed");
        setDetail(e instanceof Error ? e.message : "OPENCUT_INIT_FAILED");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state === "loading") {
    return (
      <div className="ed-empty-screen" data-testid="opencut-init-loading">
        <p>Loading editor engine…</p>
      </div>
    );
  }

  if (state === "failed") {
    return (
      <div className="ed-empty-screen" data-testid="opencut-init-failed">
        <h1>Editor initialization failed</h1>
        <p>{detail ?? "OPENCUT_INIT_FAILED"}</p>
        <p className="ed-muted">
          Baseline commit {OPENCUT_PINNED_COMMIT.slice(0, 8)} · WASM{" "}
          {getOpenCutWasmStatus().available ? "available" : "unavailable"}
        </p>
        <button type="button" className="ed-btn primary" onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div data-opencut-baseline={OPENCUT_PINNED_COMMIT} data-testid="opencut-editor-shell">
      {children}
    </div>
  );
}
