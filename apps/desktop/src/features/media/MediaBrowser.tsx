import { EmptyState } from "@/components/ui/EmptyState";
import type { MediaAsset, MediaSortKey, MediaTypeFilter } from "@/types";
import { formatDuration, StatusBadge } from "./mediaUi";

interface MediaBrowserProps {
  assets: MediaAsset[];
  selectedAssetId: string | null;
  search: string;
  typeFilter: MediaTypeFilter;
  sortKey: MediaSortKey;
  sortAsc: boolean;
  viewMode: "grid" | "list";
  onSearchChange: (value: string) => void;
  onTypeFilterChange: (value: MediaTypeFilter) => void;
  onSortKeyChange: (value: MediaSortKey) => void;
  onSortAscChange: (value: boolean) => void;
  onViewModeChange: (value: "grid" | "list") => void;
  onSelect: (id: string) => void;
}

const TYPE_OPTIONS: { value: MediaTypeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "image", label: "Image" },
  { value: "other", label: "Other" },
];

export function MediaBrowser({
  assets,
  selectedAssetId,
  search,
  typeFilter,
  sortKey,
  sortAsc,
  viewMode,
  onSearchChange,
  onTypeFilterChange,
  onSortKeyChange,
  onSortAscChange,
  onViewModeChange,
  onSelect,
}: MediaBrowserProps) {
  return (
    <div className="flex h-full flex-col gap-3" data-testid="media-browser">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search media…"
          className="min-w-[160px] flex-1 rounded-xl border border-white/10 bg-charcoal-900 px-3 py-2 text-sm outline-none ring-accent focus:ring-1"
          data-testid="media-search"
        />
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange(e.target.value as MediaTypeFilter)}
          className="rounded-xl border border-white/10 bg-charcoal-900 px-2 py-2 text-xs text-charcoal-200"
          data-testid="media-type-filter"
        >
          {TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={sortKey}
          onChange={(e) => onSortKeyChange(e.target.value as MediaSortKey)}
          className="rounded-xl border border-white/10 bg-charcoal-900 px-2 py-2 text-xs text-charcoal-200"
          data-testid="media-sort"
        >
          <option value="name">Name</option>
          <option value="kind">Type</option>
          <option value="updatedAt">Updated</option>
          <option value="duration">Duration</option>
        </select>
        <button
          type="button"
          className="rounded-xl border border-white/10 px-2 py-2 text-xs text-charcoal-300 hover:bg-white/5"
          onClick={() => onSortAscChange(!sortAsc)}
          data-testid="media-sort-dir"
        >
          {sortAsc ? "↑" : "↓"}
        </button>
        <div className="flex rounded-xl border border-white/10 p-0.5">
          {(["grid", "list"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onViewModeChange(mode)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] capitalize ${
                viewMode === mode
                  ? "bg-accent-mute text-accent-bright"
                  : "text-charcoal-400"
              }`}
              data-testid={`media-view-${mode}`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          title="No media in this view"
          description="Import files with the bar above, or clear filters to see project assets."
        />
      ) : viewMode === "grid" ? (
        <ul className="grid grid-cols-2 gap-2 overflow-auto sm:grid-cols-3 lg:grid-cols-4">
          {assets.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => onSelect(asset.id)}
                className={`flex w-full flex-col gap-2 rounded-surface border p-3 text-left transition ${
                  selectedAssetId === asset.id
                    ? "border-accent/40 bg-accent-mute/30"
                    : "border-white/[0.06] bg-charcoal-900/50 hover:border-accent/25"
                }`}
                data-testid={`media-asset-${asset.id}`}
              >
                <div className="flex aspect-video items-center justify-center rounded-lg bg-black/40 text-[10px] uppercase tracking-wide text-charcoal-500">
                  {asset.kind}
                </div>
                <p className="truncate text-xs font-medium text-charcoal-100">{asset.name}</p>
                <div className="flex items-center justify-between gap-1">
                  <StatusBadge status={asset.status} />
                  <span className="font-mono text-[10px] text-charcoal-500">
                    {formatDuration(asset.durationMs)}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-1 overflow-auto">
          {assets.map((asset) => (
            <li key={asset.id}>
              <button
                type="button"
                onClick={() => onSelect(asset.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition ${
                  selectedAssetId === asset.id
                    ? "border-accent/40 bg-accent-mute/30"
                    : "border-white/[0.06] bg-charcoal-900/40 hover:border-accent/25"
                }`}
                data-testid={`media-asset-${asset.id}`}
              >
                <span className="w-14 shrink-0 text-[10px] uppercase text-charcoal-500">
                  {asset.kind}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-charcoal-100">
                  {asset.name}
                </span>
                <StatusBadge status={asset.status} />
                <span className="font-mono text-[11px] text-charcoal-500">
                  {formatDuration(asset.durationMs)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
