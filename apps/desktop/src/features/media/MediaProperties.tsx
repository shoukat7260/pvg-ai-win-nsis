import { displayPath } from "@/lib/paths";
import { Button } from "@/components/ui/Button";
import type { MediaAsset } from "@/types";
import { formatBytes, formatDuration, StatusBadge } from "./mediaUi";

interface MediaPropertiesProps {
  asset: MediaAsset | null;
  projectPath: string | null;
  onRemove?: (assetId: string) => void;
  onGenerateThumbnail?: (assetId: string) => void;
  onGenerateWaveform?: (assetId: string) => void;
  onGenerateProxy?: (assetId: string) => void;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_1fr] gap-2 text-xs">
      <dt className="text-charcoal-500">{label}</dt>
      <dd className="truncate text-charcoal-200" title={value}>
        {value}
      </dd>
    </div>
  );
}

export function MediaProperties({
  asset,
  projectPath,
  onRemove,
  onGenerateThumbnail,
  onGenerateWaveform,
  onGenerateProxy,
}: MediaPropertiesProps) {
  if (!asset) {
    return (
      <div className="space-y-2 p-1" data-testid="media-properties-empty">
        <h3 className="text-[10px] font-medium uppercase tracking-[0.16em] text-charcoal-500">
          Properties
        </h3>
        <p className="text-sm text-charcoal-400">Select an asset to inspect metadata.</p>
      </div>
    );
  }

  const resolution =
    asset.width && asset.height ? `${asset.width}×${asset.height}` : "—";
  const path =
    asset.sourcePath ??
    (projectPath ? `${projectPath}/${asset.relativePath}` : asset.relativePath);

  return (
    <div className="space-y-4" data-testid="media-properties">
      <div>
        <h3 className="text-[10px] font-medium uppercase tracking-[0.16em] text-charcoal-500">
          Properties
        </h3>
        <p className="mt-2 font-display text-base font-semibold text-charcoal-100">
          {asset.name}
        </p>
        <div className="mt-2">
          <StatusBadge status={asset.status} />
        </div>
      </div>

      <dl className="space-y-2">
        <Row label="Path" value={displayPath(path, 48)} />
        <Row label="Type" value={asset.kind} />
        <Row label="Duration" value={formatDuration(asset.durationMs)} />
        <Row label="Resolution" value={resolution} />
        <Row label="Codec" value={asset.codec ?? "—"} />
        <Row label="Availability" value={asset.availability} />
        <Row label="Proxy" value={asset.hasProxy ? "Ready" : "None"} />
        <Row label="Size" value={formatBytes(asset.byteSize)} />
        <Row
          label="Policy"
          value={asset.sourcePolicy ? asset.sourcePolicy.toUpperCase() : "—"}
        />
      </dl>

      <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-3">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onGenerateThumbnail?.(asset.id)}
          data-testid="gen-thumbnail"
        >
          Thumbnail
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onGenerateWaveform?.(asset.id)}
          data-testid="gen-waveform"
        >
          Waveform
        </Button>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => onGenerateProxy?.(asset.id)}
          data-testid="gen-proxy"
        >
          Proxy
        </Button>
        <Button
          size="sm"
          variant="danger"
          onClick={() => onRemove?.(asset.id)}
          data-testid="remove-asset"
        >
          Remove
        </Button>
      </div>
    </div>
  );
}
