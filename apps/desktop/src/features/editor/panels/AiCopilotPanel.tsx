import { useState } from "react";
import {
  buildAiContext,
  tryLocalEditPlan,
  planToCommands,
  isDestructivePlan,
  type AiPlan,
} from "@pvg/editor-core";
import { useEditorStore } from "@/state/editorStore";
import { nativeApi } from "@/services/tauri";

const SUGGESTIONS = [
  "Make the selected clip 2x faster",
  "Split at playhead",
  "Add fade in",
  "Add marker",
  "Duplicate selected",
] as const;

export function AiCopilotPanel() {
  const project = useEditorStore((s) => s.project);
  const seq = useEditorStore((s) => s.getActiveSequence());
  const selection = useEditorStore((s) => s.selection);
  const playback = useEditorStore((s) => s.playback);
  const messages = useEditorStore((s) => s.aiMessages);
  const pushAiMessage = useEditorStore((s) => s.pushAiMessage);
  const clearAiChat = useEditorStore((s) => s.clearAiChat);
  const setPending = useEditorStore((s) => s.setPendingAiPlan);
  const dispatch = useEditorStore((s) => s.dispatch);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);

  const propose = async (override?: string) => {
    if (!project || !seq) return;
    const text = (override ?? input).trim();
    if (!text) return;
    if (!override) setInput("");
    pushAiMessage({ id: crypto.randomUUID(), role: "user", content: text });
    setBusy(true);
    try {
      const lower = text.toLowerCase();
      if (
        lower.includes("api key") ||
        lower.includes("password") ||
        lower.includes("secret") ||
        lower.includes("powershell") ||
        lower.includes("shell") ||
        lower.includes("delete my project") ||
        lower.includes("eval(")
      ) {
        pushAiMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "I can’t access secrets, credentials, or the system shell. I only propose allowlisted timeline edit commands.",
        });
        return;
      }

      const ctx = buildAiContext(
        project,
        seq.id,
        selection.clipIds,
        playback.currentTimeMs,
      );
      const plan = tryLocalEditPlan(text, ctx);

      if (!plan) {
        let hasProvider = false;
        try {
          hasProvider =
            (await nativeApi.hasProviderCredential("openrouter")) ||
            (await nativeApi.hasProviderCredential("openai")) ||
            (await nativeApi.hasProviderCredential("gemini"));
        } catch {
          hasProvider = false;
        }
        pushAiMessage({
          id: crypto.randomUUID(),
          role: "assistant",
          content: hasProvider
            ? "PVG AI could not interpret that as a safe edit plan. Try: “Make the selected clip 2x faster”, “Split at playhead”, “Add fade in”, “Duplicate selected”, or “Add marker”."
            : "Connect an AI provider in Settings → Connections for free-form requests. Meanwhile try: “Make the selected clip 2x faster”, “Split at playhead”, “Add fade in”.",
        });
        return;
      }

      setPending(plan);
      pushAiMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: plan.explanation,
        plan,
      });
    } finally {
      setBusy(false);
    }
  };

  const applyPlan = (plan: AiPlan) => {
    if (!seq) return;
    if (isDestructivePlan(plan)) {
      const ok = window.confirm(`Apply destructive AI edit?\n\n${plan.explanation}`);
      if (!ok) return;
    }
    try {
      for (const cmd of planToCommands(seq.id, plan)) dispatch(cmd);
      pushAiMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Applied ✓ — Undo with Ctrl+Z.",
      });
      setPending(null);
    } catch (e) {
      pushAiMessage({
        id: crypto.randomUUID(),
        role: "assistant",
        content: e instanceof Error ? `Could not apply: ${e.message}` : "Could not apply plan.",
      });
    }
  };

  return (
    <div className="ed-ai" data-testid="ai-copilot-panel">
      <header className="ed-ai-header">
        <div>
          <h2>PVG AI Copilot</h2>
          <p className="ed-ai-context">
            {project?.name} · {seq?.name} ·{" "}
            {selection.clipIds.length
              ? `${selection.clipIds.length} selected`
              : "nothing selected"}
          </p>
        </div>
        <button type="button" className="ed-btn ghost" onClick={clearAiChat}>
          Clear
        </button>
      </header>

      <div className="ed-ai-suggestions" aria-label="Suggested actions">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className="ed-chip"
            onClick={() => void propose(s)}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="ed-ai-messages" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <div className="ed-ai-empty">
            <p>Ask PVG AI to help edit your project.</p>
            <p className="muted">
              Allowlisted timeline commands only — no secrets, no shell.
            </p>
          </div>
        ) : null}
        {messages.map((m) => (
          <div key={m.id} className={`ed-ai-msg ${m.role}`}>
            <p>{m.content}</p>
            {m.plan ? (
              <div className="ed-ai-action-card">
                <strong>Proposed changes</strong>
                <ol>
                  {m.plan.steps.map((step, i) => (
                    <li key={i}>
                      <code>{step.tool}</code>
                    </li>
                  ))}
                </ol>
                <div className="ed-btn-row">
                  <button
                    type="button"
                    className="ed-btn primary"
                    onClick={() => applyPlan(m.plan!)}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    className="ed-btn ghost"
                    onClick={() => setPending(null)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <form
        className="ed-ai-input"
        onSubmit={(e) => {
          e.preventDefault();
          void propose();
        }}
      >
        <input
          className="pvg-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask PVG AI…"
          aria-label="AI Copilot message"
          disabled={busy}
        />
        <button
          type="submit"
          className="ed-btn primary"
          disabled={busy || !input.trim()}
        >
          {busy ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
