import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { MediaAssetStatus } from "@/types";

const STATUS_TONE: Record<
  MediaAssetStatus,
  "muted" | "accent" | "warn"
> = {
  READY: "accent",
  PROXY_READY: "accent",
  IMPORTING: "warn",
  PROCESSING: "warn",
  PROXY_PENDING: "warn",
  MISSING: "warn",
  OFFLINE: "warn",
  ERROR: "warn",
  PROXY_FAILED: "warn",
};

export function StatusBadge({ status }: { status: MediaAssetStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{status}</Badge>;
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const frames = Math.floor((ms % 1000) / (1000 / 30));
  if (h > 0) {
    return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(frames)}`;
  }
  return `${pad(m)}:${pad(s)}:${pad(frames)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatBytes(n: number | null | undefined): string {
  if (n == null || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function MediaActionButton(
  props: React.ComponentProps<typeof Button>,
) {
  return <Button size="sm" variant="ghost" {...props} />;
}
