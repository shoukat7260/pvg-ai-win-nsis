import { useState } from "react";
import { useEditorStore } from "@/state/editorStore";
import { nativeApi } from "@/services/tauri";
import { isBrowserPreview } from "@/lib/paths";
import { useToastStore } from "@/components/ToastHost";
import { formatTimecode } from "@pvg/project-format";

export function ExportModal({ onClose }: { onClose: () => void }) {
  const projectPath = useEditorStore((s) => s.projectPath);
  const seq = useEditorStore((s) => s.getActiveSequence());
  const project = useEditorStore((s) => s.project);
  const dirty = useEditorStore((s) => s.dirty);
  const save = useEditorStore((s) => s.save);
  const pushToast = useToastStore((s) => s.push);
  const [name, setName] = useState(() => project?.name ?? "export");
  const [preset, setPreset] = useState<"720p" | "1080p" | "4k">("1080p");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    outputPath: string;
    clipCount: number;
    videoLayers?: number;
    textLayers?: number;
    audioLayers?: number;
  } | null>(null);

  const durationLabel = seq
    ? formatTimecode(seq.durationMs, seq.frameRate)
    : "—";

  const run = async () => {
    if (!projectPath || !seq || !project) return;
    setBusy(true);
    setError(null);
    setResult(null);
    setProgress("Preparing…");
    try {
      if (dirty) {
        setProgress("Saving project…");
        await save();
      }
      if (isBrowserPreview()) {
        setError(
          "Export requires the PVG AI Windows desktop app (FFmpeg). Browser mode is development-only.",
        );
        return;
      }
      setProgress("Encoding MP4…");
      const safe = name.replace(/[^\w.-]+/g, "_") || "export";
      const fileName = `${safe}_${Date.now()}.mp4`;
      const res = await nativeApi.mediaExportSequence({
        projectPath,
        sequenceId: seq.id,
        outputFileName: fileName,
        preset,
      });
      setResult({
        outputPath: res.outputPath,
        clipCount: res.clipCount,
        videoLayers: res.videoLayers,
        textLayers: res.textLayers,
        audioLayers: res.audioLayers,
      });
      setProgress(null);
      pushToast("Export complete", "success");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      setProgress(null);
      pushToast("Export failed", "error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ed-modal-backdrop" role="dialog" aria-modal data-testid="export-modal">
      <div className="ed-modal" style={{ maxWidth: 520 }}>
        <header className="ed-panel-h">Export</header>
        <div className="ed-panel-b stack-gap">
          <p className="ed-hint">
            Duration: {durationLabel} · Format: MP4 · Codec: H.264 · Audio: AAC
          </p>
          <label className="ed-field">
            <span>Name</span>
            <input
              className="pvg-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              data-testid="export-name"
            />
          </label>
          <label className="ed-field">
            <span>Resolution</span>
            <select
              className="pvg-input"
              value={preset}
              onChange={(e) => setPreset(e.target.value as typeof preset)}
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4k">4K (if supported)</option>
            </select>
          </label>
          <p className="ed-hint">
            Frame rate follows the sequence ({seq?.frameRate ?? "—"} fps). Bitrate uses the
            recommended desktop preset. Multi-layer compositing is limited in this build.
          </p>
          {progress ? <p className="ed-hint" data-testid="export-progress">{progress}</p> : null}
          {error ? (
            <p className="ed-error" data-testid="export-error">
              {error}
            </p>
          ) : null}
          {result ? (
            <p className="ed-hint" data-testid="export-success">
              Exported {result.clipCount} clip(s)
              {result.videoLayers != null
                ? ` · V${result.videoLayers}/T${result.textLayers ?? 0}/A${result.audioLayers ?? 0}`
                : ""}{" "}
              → {result.outputPath}
            </p>
          ) : null}
          <div className="ed-row gap">
            <button
              type="button"
              className="ed-btn primary"
              disabled={busy || !seq}
              onClick={() => void run()}
              data-testid="export-run"
            >
              {busy ? "Exporting…" : result ? "Export again" : "Export"}
            </button>
            <button type="button" className="ed-btn ghost" onClick={onClose} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
