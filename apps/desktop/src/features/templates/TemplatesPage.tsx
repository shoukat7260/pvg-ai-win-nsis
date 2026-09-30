import { useNavigate } from "react-router-dom";

const CATEGORIES = [
  "Featured",
  "Social",
  "Business",
  "Marketing",
  "Product",
  "UGC",
  "Reels",
  "Shorts",
  "Intros",
] as const;

const PLACEHOLDER_TEMPLATES = [
  { id: "t1", name: "Product spotlight", duration: "0:15", ratio: "9:16", cat: "Product" },
  { id: "t2", name: "Social hook", duration: "0:08", ratio: "9:16", cat: "Social" },
  { id: "t3", name: "UGC testimonial", duration: "0:30", ratio: "9:16", cat: "UGC" },
  { id: "t4", name: "Brand intro", duration: "0:10", ratio: "16:9", cat: "Intros" },
] as const;

export function TemplatesPage() {
  const navigate = useNavigate();

  return (
    <div data-testid="templates-page">
      <div className="pvg-section-head" style={{ marginTop: 0 }}>
        <h2>Templates</h2>
        <p style={{ margin: 0, fontSize: 12, color: "var(--pvg-text-muted)" }}>
          Original PVG layouts only — no third-party copyrighted packs.
        </p>
      </div>

      <div className="pvg-chip-row" style={{ justifyContent: "flex-start", marginBottom: 16 }}>
        {CATEGORIES.map((c) => (
          <span key={c} className="pvg-chip" style={{ cursor: "default" }}>
            {c}
          </span>
        ))}
      </div>

      <div className="pvg-project-grid">
        {PLACEHOLDER_TEMPLATES.map((t) => (
          <div key={t.id} className="pvg-project-card" style={{ cursor: "default" }}>
            <div className="pvg-project-card__thumb">
              {t.ratio} · {t.duration}
            </div>
            <div className="pvg-project-card__body">
              <div className="pvg-project-card__name">{t.name}</div>
              <div className="pvg-project-card__meta">{t.cat}</div>
            </div>
            <div style={{ padding: "0 10px 10px", display: "flex", gap: 8 }}>
              <button
                type="button"
                className="pvg-btn pvg-btn--primary"
                style={{ height: 28, fontSize: 11 }}
                onClick={() => navigate("/app/home?create=1")}
              >
                Use template
              </button>
              <button
                type="button"
                className="pvg-btn pvg-btn--ghost"
                style={{ height: 28, fontSize: 11 }}
                onClick={() =>
                  window.alert("Preview will play original PVG template media when assets ship.")
                }
              >
                Preview
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
