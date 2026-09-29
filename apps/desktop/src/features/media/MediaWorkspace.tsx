import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GlassPanel } from "@/components/ui/GlassPanel";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/state/appStore";
import {
  selectFilteredAssets,
  useMediaStore,
} from "@/state/mediaStore";
import type { MediaImportMode, MediaTypeFilter } from "@/types";
import { ImportBar } from "./ImportBar";
import { JobCenter } from "./JobCenter";
import { MediaBrowser } from "./MediaBrowser";
import { MediaProperties } from "./MediaProperties";
import { SourcePreview } from "./SourcePreview";

const BIN_FILTERS: { id: MediaTypeFilter | "favorites"; label: string }[] = [
  { id: "all", label: "All media" },
  { id: "video", label: "Video" },
  { id: "audio", label: "Audio" },
  { id: "image", label: "Image" },
  { id: "other", label: "Other" },
];

export function MediaWorkspace() {
  const project = useAppStore((s) => s.currentProject);
  const appProxyMode = useAppStore((s) => s.appSettings.proxyMode);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [importing, setImporting] = useState(false);

  const assets = useMediaStore((s) => s.assets);
  const selectedAssetId = useMediaStore((s) => s.selectedAssetId);
  const jobs = useMediaStore((s) => s.jobs);
  const search = useMediaStore((s) => s.search);
  const typeFilter = useMediaStore((s) => s.typeFilter);
  const sortKey = useMediaStore((s) => s.sortKey);
  const sortAsc = useMediaStore((s) => s.sortAsc);
  const previewSource = useMediaStore((s) => s.previewSource);
  const loading = useMediaStore((s) => s.loading);
  const error = useMediaStore((s) => s.error);
  const dirty = useMediaStore((s) => s.dirty);

  const setSearch = useMediaStore((s) => s.setSearch);
  const setTypeFilter = useMediaStore((s) => s.setTypeFilter);
  const setSortKey = useMediaStore((s) => s.setSortKey);
  const setSortAsc = useMediaStore((s) => s.setSortAsc);
  const setPreviewSource = useMediaStore((s) => s.setPreviewSource);
  const selectAsset = useMediaStore((s) => s.selectAsset);
  const refreshAssets = useMediaStore((s) => s.refreshAssets);
  const refreshJobs = useMediaStore((s) => s.refreshJobs);
  const importFiles = useMediaStore((s) => s.importFiles);
  const removeAsset = useMediaStore((s) => s.removeAsset);
  const generateThumbnail = useMediaStore((s) => s.generateThumbnail);
  const generateWaveform = useMediaStore((s) => s.generateWaveform);
  const generateProxy = useMediaStore((s) => s.generateProxy);
  const cancelJob = useMediaStore((s) => s.cancelJob);

  const projectPath = project?.path ?? null;

  useEffect(() => {
    // Seed preview source from preferences once when prefs change.
    if (previewSource !== appProxyMode) {
      setPreviewSource(appProxyMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only sync when preference changes
  }, [appProxyMode]);

  useEffect(() => {
    if (!projectPath) return;
    void refreshAssets(projectPath);
    void refreshJobs();
    const id = window.setInterval(() => {
      void refreshJobs();
    }, 4000);
    return () => window.clearInterval(id);
  }, [projectPath, refreshAssets, refreshJobs]);

  const filtered = useMemo(
    () => selectFilteredAssets({ assets, search, typeFilter, sortKey, sortAsc }),
    [assets, search, typeFilter, sortKey, sortAsc],
  );
  const selected = useMemo(
    () => assets.find((a) => a.id === selectedAssetId) ?? null,
    [assets, selectedAssetId],
  );

  const onImport = async (
    files: Array<{ path: string; file?: File }>,
    mode: MediaImportMode,
  ) => {
    if (!projectPath) return;
    setImporting(true);
    try {
      await importFiles(projectPath, files, mode);
    } finally {
      setImporting(false);
    }
  };

  if (!project) {
    return (
      <div className="mx-auto max-w-2xl" data-testid="media-workspace">
        <EmptyState
          title="No project selected"
          description="Open or create a project from Home, then return here to import and browse media."
          action={
            <Link
              to="/app/home"
              className="inline-flex items-center justify-center rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-charcoal-950 hover:bg-accent-bright"
              data-testid="media-go-home"
            >
              Go to Home
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div
      className="flex h-[calc(100vh-4rem)] min-h-[520px] flex-col gap-3"
      data-testid="media-workspace"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="accent">Phase 3 · Media</Badge>
          <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight text-charcoal-100">
            Media workspace
          </h1>
          <p className="mt-1 text-sm text-charcoal-400">
            Import, preview, and prepare proxies for{" "}
            <span className="text-charcoal-200">{project.name}</span>
            {dirty ? (
              <span className="ml-2 text-warn" data-testid="media-dirty">
                · unsaved changes
              </span>
            ) : null}
          </p>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            void refreshAssets(project.path);
            void refreshJobs();
          }}
          disabled={loading}
        >
          Refresh
        </Button>
      </header>

      {error ? (
        <ErrorState
          message={error}
          onRetry={() => {
            void refreshAssets(project.path);
            void refreshJobs();
          }}
        />
      ) : null}

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-[200px_minmax(0,1fr)_260px]">
        {/* Left: bins / filters */}
        <GlassPanel className="flex flex-col gap-4 p-4" data-testid="media-bins">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-charcoal-500">
              Bins
            </p>
            <ul className="mt-2 space-y-1">
              {BIN_FILTERS.map((bin) => (
                <li key={bin.id}>
                  <button
                    type="button"
                    onClick={() => setTypeFilter(bin.id as MediaTypeFilter)}
                    className={`w-full rounded-xl px-3 py-2 text-left text-sm transition ${
                      typeFilter === bin.id
                        ? "bg-accent-mute text-accent-bright"
                        : "text-charcoal-300 hover:bg-white/5"
                    }`}
                  >
                    {bin.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <ImportBar
            disabled={!projectPath}
            busy={importing}
            onImport={onImport}
          />
        </GlassPanel>

        {/* Center: browser + preview */}
        <div className="flex min-h-0 flex-col gap-3">
          <GlassPanel className="min-h-0 flex-1 overflow-hidden p-4">
            {loading && assets.length === 0 ? (
              <p className="text-sm text-charcoal-400 animate-soft-pulse">Loading assets…</p>
            ) : (
              <MediaBrowser
                assets={filtered}
                selectedAssetId={selectedAssetId}
                search={search}
                typeFilter={typeFilter}
                sortKey={sortKey}
                sortAsc={sortAsc}
                viewMode={viewMode}
                onSearchChange={setSearch}
                onTypeFilterChange={setTypeFilter}
                onSortKeyChange={setSortKey}
                onSortAscChange={setSortAsc}
                onViewModeChange={setViewMode}
                onSelect={selectAsset}
              />
            )}
          </GlassPanel>
          <GlassPanel className="p-4">
            <SourcePreview
              asset={selected}
              previewSource={previewSource}
              onPreviewSourceChange={setPreviewSource}
            />
          </GlassPanel>
        </div>

        {/* Right: properties */}
        <GlassPanel className="overflow-auto p-4">
          <MediaProperties
            asset={selected}
            projectPath={projectPath}
            onRemove={(id) => void removeAsset(project.path, id)}
            onGenerateThumbnail={(id) => void generateThumbnail(project.path, id)}
            onGenerateWaveform={(id) => void generateWaveform(project.path, id)}
            onGenerateProxy={(id) => void generateProxy(project.path, id)}
          />
        </GlassPanel>
      </div>

      {/* Bottom job strip */}
      <GlassPanel className="p-4" data-testid="media-job-strip">
        <JobCenter
          jobs={jobs}
          onCancel={(id) => void cancelJob(id)}
          onRefresh={() => void refreshJobs()}
        />
      </GlassPanel>
    </div>
  );
}
