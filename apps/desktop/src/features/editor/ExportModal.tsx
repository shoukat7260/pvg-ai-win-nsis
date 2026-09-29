import { useState } from "react";
import { useEditorStore } from "@/state/editorStore";
import { nativeApi } from "@/services/tauri";
import { isBrowserPreview } from "@/lib/paths";

export function ExportModal({ onClose }: { onClose: () => void }) {
  const projectPath = useEditorStore((s) => s.projectPath);
  const seq = useEditorStore((s) => s.getActiveSequence());
  const project = useEditorStore((s) => s.project);
  const dirty = useEditorStore((s) => s.dirty);
  const save = useEditorStore((s) => s.save);
  const [preset, setPreset] = useState<"720p" | "1080p" | "4k">("1080p");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    outputPath: string;
    clipCount: number;
    videoLayers?: number;
    textLayers?: number;
    audioLayers?: number;
  } | null>(null);

  const run = async () => {
    if (!projectPath || !seq || !project) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      if (dirty) await save();
      if (isBrowserPreview()) {
        setError(
          "Export requires the PVG AI Windows desktop app (FFmpeg). Browser mode is development-only.",
        );
        return;
      }
      const fileName = `${project.name.replace(/[^\w.-]+/g, "_")}_${Date.now()}.mp4`;
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
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="ed-modal-backdrop" role="dialog" aria-modal data-testid="export-modal">
      <div className="ed-modal">
        <header className="ed-panel-h">Export Sequence</header>
        <div className="ed-panel-b stack-gap">
          <p className="ed-hint">
            Real H.264/AAC MP4 via local FFmpeg. Primary video track clips are rendered in
            timeline order. Multi-layer compositing is limited in this build.
          </p>
          <label className="ed-field">
            <span>Preset</span>
            <select
              className="pvg-input"
              value={preset}
              onChange={(e) => setPreset(e.target.value as typeof preset)}
            >
              <option value="720p">720p</option>
              <option value="1080p">1080p</option>
              <option value="4k">4K</option>
            </select>
          </label>
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
              {busy ? "Exporting…" : "Export MP4"}
            </button>
            <button type="button" className="ed-btn ghost" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
