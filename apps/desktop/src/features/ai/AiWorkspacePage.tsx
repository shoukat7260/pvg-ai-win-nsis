import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const QUICK = [
  { id: "ugc", label: "UGC Ad" },
  { id: "product", label: "Product Video" },
  { id: "ai-video", label: "AI Video" },
  { id: "social", label: "Social Reel" },
  { id: "photos", label: "Product Photos" },
] as const;

type ChatMsg = { role: "user" | "assistant"; text: string };

const STORAGE_KEY = "pvg.ai.workspace.chat.v1";

function loadChat(): ChatMsg[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMsg[];
    return Array.isArray(parsed) ? parsed.slice(-40) : [];
  } catch {
    return [];
  }
}

export function AiWorkspacePage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>(() => loadChat());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const intent = params.get("intent");
    if (intent === "ugc") {
      setPrompt("Help me create a UGC ad for my product.");
    } else if (intent === "ai-video") {
      setPrompt("I want to generate an AI video from a short brief.");
    }
  }, [params]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      // ignore quota
    }
  }, [messages]);

  const send = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const reply = craftReply(trimmed);
    setMessages((m) => [
      ...m,
      { role: "user", text: trimmed },
      { role: "assistant", text: reply },
    ]);
    setPrompt("");
  };

  const startUgcShell = () => {
    setNotice(
      "UGC Ad entry is ready for Phase 5 generation. Creating a blank project shell you can open now.",
    );
    navigate("/app/home?create=1");
  };

  return (
    <div data-testid="ai-workspace">
      <div className="pvg-ai-hero">
        <h1>What do you want to create?</h1>
        <p>
          PVG AI workspace assistant — outside the editor. Chat persists on this device.
          Full UGC generation plugs in during Phase 5.
        </p>
        <textarea
          className="pvg-ai-prompt"
          placeholder="Describe your idea…"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          data-testid="ai-prompt"
        />
        <div style={{ marginTop: 12, display: "flex", justifyContent: "center", gap: 8 }}>
          <button
            type="button"
            className="pvg-btn pvg-btn--primary"
            onClick={() => send(prompt)}
            data-testid="ai-send"
          >
            Send
          </button>
          <button type="button" className="pvg-btn pvg-btn--ghost" onClick={startUgcShell}>
            UGC Ad flow
          </button>
        </div>
        <div className="pvg-chip-row">
          {QUICK.map((q) => (
            <button
              key={q.id}
              type="button"
              className="pvg-chip"
              onClick={() => {
                if (q.id === "ugc") startUgcShell();
                else send(`Help me with: ${q.label}`);
              }}
            >
              {q.label}
            </button>
          ))}
        </div>
        {notice ? (
          <p style={{ marginTop: 12, fontSize: 12, color: "var(--pvg-warning)" }}>{notice}</p>
        ) : null}
      </div>

      {messages.length > 0 ? (
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
          data-testid="ai-chat-history"
        >
          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              style={{
                alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                maxWidth: "85%",
                padding: "10px 12px",
                borderRadius: 10,
                background:
                  m.role === "user" ? "var(--pvg-accent-muted)" : "var(--pvg-surface)",
                border: "1px solid var(--pvg-border)",
                fontSize: 13,
                whiteSpace: "pre-wrap",
              }}
            >
              {m.text}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function craftReply(input: string): string {
  const lower = input.toLowerCase();
  if (lower.includes("ugc")) {
    return [
      "UGC Ad shell (Phase 4.3):",
      "1) Upload product media",
      "2) Write brief + platform + duration",
      "3) Review storyboard",
      "4) Generation plan → OpenCut project",
      "",
      "Full AI generation lands in Phase 5. You can create a blank project now and prep media in Library.",
    ].join("\n");
  }
  if (lower.includes("caption") || lower.includes("voice")) {
    return "Captions and voice workflows are available from the editor after you open a project. Auto-captions export with the timeline when configured.";
  }
  if (lower.includes("template")) {
    return "Open Templates from the sidebar to browse original PVG layouts. Using a template creates a project with a populated timeline when assets are available.";
  }
  return "I can help with UGC ads, AI video briefs, product videos, templates, media, captions, and opening the professional editor. Say what you want to create next.";
}
