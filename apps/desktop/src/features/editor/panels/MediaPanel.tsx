import { useEffect, useMemo, useState } from "react";
import { useEditorStore } from "@/state/editorStore";
import { useAppStore } from "@/state/appStore";
import { selectFilteredAssets, useMediaStore } from "@/state/mediaStore";
import { ImportBar } from "@/features/media/ImportBar";
import { MediaBrowser } from "@/features/media/MediaBrowser";
import type { MediaImportMode } from "@/types";

export function MediaPanel() {
  const editorPath = useEditorStore((s) => s.projectPath);
  const appProject = useAppStore((s) => s.currentProject);
  const projectPath = editorPath ?? appProject?.path ?? null;
  const appendAssetToTimeline = useEditorStore((s) => s.appendAssetToTimeline);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [importing, setImporting] = useState(false);

  const allAssets = useMediaStore((s) => s.assets);
  const selectedAssetId = useMediaStore((s) => s.selectedAssetId);
  const search = useMediaStore((s) => s.search);
  const typeFilter = useMediaStore((s) => s.typeFilter);
  const sortKey = useMediaStore((s) => s.sortKey);
  const sortAsc = useMediaStore((s) => s.sortAsc);
  const setSearch = useMediaStore((s) => s.setSearch);
  const setTypeFilter = useMediaStore((s) => s.setTypeFilter);
  const setSortKey = useMediaStore((s) => s.setSortKey);
  const setSortAsc = useMediaStore((s) => s.setSortAsc);
  const selectAsset = useMediaStore((s) => s.selectAsset);
  const refreshAssets = useMediaStore((s) => s.refreshAssets);
  const importFiles = useMediaStore((s) => s.importFiles);

  const assets = useMemo(
    () =>
      selectFilteredAssets({
        assets: allAssets,
        search,
        typeFilter,
        sortKey,
        sortAsc,
      }),
    [allAssets, search, typeFilter, sortKey, sortAsc],
  );

  useEffect(() => {
    if (projectPath) void refreshAssets(projectPath);
  }, [projectPath, refreshAssets]);

  return (
    <div className="ed-panel" data-testid="editor-media-panel">
      <header className="ed-panel-h sticky">Media</header>
      <div className={`ed-panel-b editor-media-body ${allAssets.length > 0 ? "has-assets" : ""}`}>
        {projectPath ? (
          <div className={allAssets.length > 0 ? "ed-import-compact" : ""}>
            <ImportBar
              busy={importing}
              onImport={async (files, mode: MediaImportMode) => {
                setImporting(true);
                try {
                  await importFiles(projectPath, files, mode);
                } finally {
                  setImporting(false);
                }
              }}
            />
          </div>
        ) : null}
        <MediaBrowser
          assets={assets}
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
        <div className="ed-media-actions">
          <button
            type="button"
            className="ed-btn primary block"
            disabled={!selectedAssetId}
            onClick={() => {
              const a = allAssets.find((x) => x.id === selectedAssetId);
              if (!a) return;
              appendAssetToTimeline(
                a.id,
                a.kind,
                a.durationMs ?? 5000,
                a.name,
              );
            }}
          >
            Append to timeline
          </button>
          {allAssets.length === 0 ? (
            <p className="ed-hint">Import media to begin editing.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
