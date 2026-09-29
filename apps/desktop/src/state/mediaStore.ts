import { create } from "zustand";
import { nativeApi } from "@/services/tauri";
import type {
  JobSnapshot,
  MediaAsset,
  MediaImportMode,
  MediaSortKey,
  MediaTypeFilter,
  PreviewSource,
} from "@/types";
import { toMediaAsset } from "@/types";

interface MediaState {
  assets: MediaAsset[];
  selectedAssetId: string | null;
  jobs: JobSnapshot[];
  search: string;
  typeFilter: MediaTypeFilter;
  sortKey: MediaSortKey;
  sortAsc: boolean;
  previewSource: PreviewSource;
  dirty: boolean;
  loading: boolean;
  jobsLoading: boolean;
  error: string | null;
  lastProjectPath: string | null;

  setSearch: (search: string) => void;
  setTypeFilter: (filter: MediaTypeFilter) => void;
  setSortKey: (key: MediaSortKey) => void;
  setSortAsc: (asc: boolean) => void;
  setPreviewSource: (source: PreviewSource) => void;
  selectAsset: (id: string | null) => void;
  markDirty: () => void;
  clearDirty: () => void;
  reset: () => void;

  refreshAssets: (projectPath: string) => Promise<void>;
  importFiles: (
    projectPath: string,
    files: Array<{ path: string; file?: File }>,
    mode: MediaImportMode,
  ) => Promise<void>;
  removeAsset: (projectPath: string, assetId: string) => Promise<void>;
  generateThumbnail: (projectPath: string, assetId: string) => Promise<void>;
  generateWaveform: (projectPath: string, assetId: string) => Promise<void>;
  generateProxy: (
    projectPath: string,
    assetId: string,
    profile?: string,
  ) => Promise<void>;
  refreshJobs: () => Promise<void>;
  cancelJob: (jobId: string) => Promise<void>;
}

/**
 * Media browser state. Intentionally excludes API keys, tokens, and vault secrets.
 */
export const useMediaStore = create<MediaState>((set, get) => ({
  assets: [],
  selectedAssetId: null,
  jobs: [],
  search: "",
  typeFilter: "all",
  sortKey: "name",
  sortAsc: true,
  previewSource: "auto",
  dirty: false,
  loading: false,
  jobsLoading: false,
  error: null,
  lastProjectPath: null,

  setSearch: (search) => set({ search }),
  setTypeFilter: (typeFilter) => set({ typeFilter }),
  setSortKey: (sortKey) => set({ sortKey }),
  setSortAsc: (sortAsc) => set({ sortAsc }),
  setPreviewSource: (previewSource) => set({ previewSource }),
  selectAsset: (selectedAssetId) => set({ selectedAssetId }),
  markDirty: () => set({ dirty: true }),
  clearDirty: () => set({ dirty: false }),
  reset: () =>
    set({
      assets: [],
      selectedAssetId: null,
      jobs: [],
      search: "",
      typeFilter: "all",
      error: null,
      dirty: false,
      lastProjectPath: null,
    }),

  refreshAssets: async (projectPath) => {
    set({ loading: true, error: null, lastProjectPath: projectPath });
    try {
      const dtos = await nativeApi.mediaListAssets(projectPath);
      const assets = dtos.map(toMediaAsset);
      const selected = get().selectedAssetId;
      set({
        assets,
        loading: false,
        selectedAssetId:
          selected && assets.some((a) => a.id === selected)
            ? selected
            : assets[0]?.id ?? null,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to list assets",
      });
    }
  },

  importFiles: async (projectPath, files, mode) => {
    set({ error: null });
    try {
      const { registerMediaBlob } = await import("@/services/mediaBlobRegistry");
      for (const entry of files) {
        const sourcePath = entry.path;
        // Validate path via probe before import (native rejects unsafe paths).
        // Browser stub accepts any string; still required for symmetry.
        try {
          await nativeApi.mediaProbe(sourcePath);
        } catch {
          /* browser stub may fail for bare filenames — continue import */
        }
        const result = await nativeApi.mediaImport({
          projectPath,
          sourcePath,
          mode,
          name: entry.file?.name,
        });
        if (entry.file && result?.asset?.id) {
          registerMediaBlob(result.asset.id, entry.file);
        }
      }
      set({ dirty: true });
      await get().refreshAssets(projectPath);
      await get().refreshJobs();
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Import failed",
      });
      throw err;
    }
  },

  removeAsset: async (projectPath, assetId) => {
    set({ error: null });
    try {
      const { revokeMediaBlob } = await import("@/services/mediaBlobRegistry");
      revokeMediaBlob(assetId);
      await nativeApi.mediaRemoveAsset(projectPath, assetId);
      set({ dirty: true });
      if (get().selectedAssetId === assetId) {
        set({ selectedAssetId: null });
      }
      await get().refreshAssets(projectPath);
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Remove failed",
      });
      throw err;
    }
  },

  generateThumbnail: async (projectPath, assetId) => {
    await nativeApi.mediaGenerateThumbnail(projectPath, assetId);
    set({ dirty: true });
    await get().refreshJobs();
  },

  generateWaveform: async (projectPath, assetId) => {
    await nativeApi.mediaGenerateWaveform(projectPath, assetId);
    set({ dirty: true });
    await get().refreshJobs();
  },

  generateProxy: async (projectPath, assetId, profile) => {
    await nativeApi.mediaGenerateProxy(projectPath, assetId, profile);
    set({ dirty: true });
    await get().refreshJobs();
  },

  refreshJobs: async () => {
    set({ jobsLoading: true });
    try {
      const jobs = await nativeApi.mediaListJobs();
      set({ jobs, jobsLoading: false });
    } catch (err) {
      set({
        jobsLoading: false,
        error: err instanceof Error ? err.message : "Failed to list jobs",
      });
    }
  },

  cancelJob: async (jobId) => {
    await nativeApi.mediaCancelJob(jobId);
    await get().refreshJobs();
  },
}));

export function selectFilteredAssets(state: {
  assets: MediaAsset[];
  search: string;
  typeFilter: MediaTypeFilter;
  sortKey: MediaSortKey;
  sortAsc: boolean;
}): MediaAsset[] {
  const q = state.search.trim().toLowerCase();
  let list = state.assets;
  if (state.typeFilter !== "all") {
    list = list.filter((a) => a.kind === state.typeFilter);
  }
  if (q) {
    list = list.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.kind.includes(q) ||
        (a.codec?.toLowerCase().includes(q) ?? false) ||
        (a.sourcePath?.toLowerCase().includes(q) ?? false),
    );
  }
  const dir = state.sortAsc ? 1 : -1;
  return [...list].sort((a, b) => {
    switch (state.sortKey) {
      case "kind":
        return a.kind.localeCompare(b.kind) * dir;
      case "updatedAt":
        return a.updatedAt.localeCompare(b.updatedAt) * dir;
      case "duration":
        return ((a.durationMs ?? 0) - (b.durationMs ?? 0)) * dir;
      case "name":
      default:
        return a.name.localeCompare(b.name) * dir;
    }
  });
}
