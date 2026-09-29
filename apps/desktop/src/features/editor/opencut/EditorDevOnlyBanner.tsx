import { useEffect, useState } from "react";
import { isBrowserPreview } from "@/lib/paths";

type ReleaseManifest = {
  product?: string;
  version: string;
  build: string;
  commit: string;
  timestamp: string;
  sha256: string;
  artifact: string;
  architecture: string;
  fileSizeBytes?: number;
} | null;

function formatBytes(n?: number): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function loadWindowsRelease(): Promise<ReleaseManifest> {
  try {
    const res = await fetch("/downloads/windows/release.json", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as ReleaseManifest;
    if (!data?.artifact || !data?.sha256 || !data?.version) return null;
    return data;
  } catch {
    return null;
  }
}

/** Browser `/app/edit` is development/QA only — production editing is Tauri desktop. */
export function EditorDevOnlyBanner() {
  if (!isBrowserPreview()) return null;
  return <DevBannerInner />;
}

function DevBannerInner() {
  const [release, setRelease] = useState<ReleaseManifest>(null);
  useEffect(() => {
    void loadWindowsRelease().then(setRelease);
  }, []);

  const ready = Boolean(release?.artifact && release.sha256);

  return (
    <div className="ed-dev-banner" role="status" data-testid="editor-dev-only-banner">
      <div className="ed-dev-banner-main">
        <strong>PVG AI Desktop — Windows Edition</strong>
        <span className="ed-dev-banner-sub">
          Development editor. Production editing uses the Windows desktop app.
        </span>
        {ready ? (
          <span className="ed-dev-banner-meta" data-testid="windows-release-meta">
            Version {release!.version} · Windows 10/11 — {release!.architecture} ·{" "}
            {formatBytes(release!.fileSizeBytes)} · Build {release!.build} ·{" "}
            {release!.commit.slice(0, 8)}
            <br />
            SHA-256: <code data-testid="windows-release-sha">{release!.sha256}</code>
          </span>
        ) : null}
      </div>
      <div className="ed-dev-banner-dl" data-testid="windows-download-panel">
        {ready ? (
          <a
            className="ed-btn primary"
            href={`/downloads/windows/${release!.artifact}`}
            data-testid="download-windows-btn"
          >
            Download for Windows
          </a>
        ) : (
          <button
            type="button"
            className="ed-btn"
            disabled
            title="Windows installer not published yet"
            data-testid="download-windows-unavailable"
          >
            Windows build unavailable
          </button>
        )}
      </div>
    </div>
  );
}
