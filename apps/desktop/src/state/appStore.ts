import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type {
  AppSettings,
  ConnectionMetadata,
  CurrentUser,
  CurrentWorkspace,
  DiagnosticsReport,
  ProjectMetadata,
} from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

interface AppState {
  currentUser: CurrentUser | null;
  currentWorkspace: CurrentWorkspace | null;
  currentProject: ProjectMetadata | null;
  appSettings: AppSettings;
  connectionMetadata: ConnectionMetadata;
  diagnostics: DiagnosticsReport | null;
  hydrated: boolean;
  setUser: (user: CurrentUser | null) => void;
  setWorkspace: (workspace: CurrentWorkspace | null) => void;
  setProject: (project: ProjectMetadata | null) => void;
  patchSettings: (patch: Partial<AppSettings>) => void;
  setConnection: (meta: Partial<ConnectionMetadata>) => void;
  setDiagnostics: (report: DiagnosticsReport | null) => void;
  setHydrated: (value: boolean) => void;
  resetFoundationSession: () => void;
}

/**
 * Persisted app state intentionally excludes secrets.
 * Tokens / vault secrets must never be stored here.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      currentUser: null,
      currentWorkspace: null,
      currentProject: null,
      appSettings: DEFAULT_SETTINGS,
      connectionMetadata: {
        mode: "LOCAL_ONLY",
        apiBaseUrl: null,
        lastCheckedAt: null,
        reachable: null,
      },
      diagnostics: null,
      hydrated: false,
      setUser: (currentUser) => set({ currentUser }),
      setWorkspace: (currentWorkspace) => set({ currentWorkspace }),
      setProject: (currentProject) => set({ currentProject }),
      patchSettings: (patch) =>
        set((s) => ({ appSettings: { ...s.appSettings, ...patch } })),
      setConnection: (meta) =>
        set((s) => ({
          connectionMetadata: { ...s.connectionMetadata, ...meta },
        })),
      setDiagnostics: (diagnostics) => set({ diagnostics }),
      setHydrated: (hydrated) => set({ hydrated }),
      resetFoundationSession: () =>
        set({
          currentUser: null,
          currentWorkspace: null,
          currentProject: null,
        }),
    }),
    {
      name: "pvg-app-foundation",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        appSettings: state.appSettings,
        connectionMetadata: {
          mode: state.connectionMetadata.mode,
          apiBaseUrl: state.connectionMetadata.apiBaseUrl,
          lastCheckedAt: state.connectionMetadata.lastCheckedAt,
          reachable: state.connectionMetadata.reachable,
        },
        // Explicitly omit currentUser secrets (none exist) — only keep local placeholder ids if needed later.
        currentWorkspace: state.currentWorkspace
          ? {
              id: state.currentWorkspace.id,
              displayName: state.currentWorkspace.displayName,
              projectsRoot: state.currentWorkspace.projectsRoot,
              dataRoot: state.currentWorkspace.dataRoot,
            }
          : null,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.appSettings = { ...DEFAULT_SETTINGS, ...state.appSettings };
          state.setHydrated(true);
        }
      },
    },
  ),
);
