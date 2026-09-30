import { create } from "zustand";

export type ToastTone = "info" | "success" | "error";

export interface ToastItem {
  id: string;
  message: string;
  tone: ToastTone;
}

interface ToastState {
  items: ToastItem[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set) => ({
  items: [],
  push: (message, tone = "info") => {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    set((s) => ({ items: [...s.items.slice(-4), { id, message, tone }] }));
    window.setTimeout(() => {
      set((s) => ({ items: s.items.filter((t) => t.id !== id) }));
    }, 4200);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

export function ToastHost() {
  const items = useToastStore((s) => s.items);
  const dismiss = useToastStore((s) => s.dismiss);
  if (!items.length) return null;
  return (
    <div className="pvg-toast-host" aria-live="polite">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pvg-toast${t.tone === "error" ? " pvg-toast--error" : ""}`}
          role="status"
        >
          <span>{t.message}</span>
          <button
            type="button"
            className="pvg-btn pvg-btn--ghost"
            style={{ height: 24, marginLeft: 8, padding: "0 8px", fontSize: 11 }}
            onClick={() => dismiss(t.id)}
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
