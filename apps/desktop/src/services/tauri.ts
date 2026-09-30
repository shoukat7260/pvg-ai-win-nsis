import { invoke } from "@tauri-apps/api/core";
import { isBrowserPreview } from "@/lib/paths";
import type {
  AutosaveEntry,
  AutosaveWriteResult,
  DiagnosticsReport,
  JobSnapshot,
  LocalWorkspaceInfo,
  MediaEngineStatus,
  MediaImportMode,
  MediaImportResult,
  ProbeResult,
  ProgressEvent,
  ProjectAssetDto,
  ProjectMetadata,
  StorageSummary,
  VaultCredentialMeta,
} from "@/types";

async function invokeCommand<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (isBrowserPreview()) {
    return browserFallback<T>(cmd, args);
  }
  return invoke<T>(cmd, args);
}

const previewVault = new Map<string, { secret: string; label: string }>();

/** In-memory media stubs for browser / Vite preview — never persists secrets. */
const previewAssets = new Map<string, ProjectAssetDto[]>();
const previewJobs: JobSnapshot[] = [];
/** Full project documents for browser preview editor. */
const previewDocuments = new Map<string, Record<string, unknown>>();
const previewTrash = new Map<string, Record<string, unknown>>();

function previewMeta(
  doc: Record<string, unknown>,
  path: string,
  trashed = false,
  nowOverride?: string,
) {
  return {
    id: doc.id,
    name: doc.name,
    path,
    workspaceId: doc.workspaceId,
    schemaVersion: doc.schemaVersion ?? 3,
    createdAt: doc.createdAt,
    updatedAt: nowOverride ?? doc.updatedAt,
    description: doc.description ?? "",
    thumbnailPath: doc.thumbnailPath ?? null,
    durationMs: doc.durationMs ?? 0,
    trashed,
  };
}

function makePreviewDocument(
  name: string,
  path: string,
  workspaceId: string,
  description = "",
): Record<string, unknown> {
  const now = new Date().toISOString();
  const seqId = crypto.randomUUID?.() ?? "550e8400-e29b-41d4-a716-4466554400aa";
  const tracks = ["V1", "V2", "Overlay", "Text", "A1", "A2"].map((trackName, i) => ({
    id: crypto.randomUUID?.() ?? `550e8400-e29b-41d4-a716-${String(i + 100).padStart(12, "0")}`,
    type: trackName.startsWith("A")
      ? "audio"
      : trackName === "Text"
        ? "text"
        : trackName === "Overlay"
          ? "overlay"
          : "video",
    name: trackName,
    enabled: true,
    locked: false,
    muted: false,
    solo: false,
    visible: true,
    height: 48,
    colorLabel: null,
    clips: [],
  }));
  return {
    id: crypto.randomUUID?.() ?? "550e8400-e29b-41d4-a716-446655440001",
    name,
    schemaVersion: 3,
    workspaceId,
    createdAt: now,
    updatedAt: now,
    lastSavedAt: null,
    appVersion: "0.1.0",
    lastRecoveredAt: null,
    description,
    tags: [],
    assets: [],
    bins: [],
    sequences: [
      {
        id: seqId,
        name: "Sequence 1",
        durationMs: 0,
        frameRate: 30,
        width: 1920,
        height: 1080,
        sampleRate: 48000,
        backgroundColor: "#000000",
        tracks,
        markers: [],
      },
    ],
    settings: {
      frameRate: 30,
      width: 1920,
      height: 1080,
      sampleRate: 48000,
      locale: "en-US",
      previewQuality: "balanced",
      proxyMode: "auto",
      defaultBackground: "#000000",
    },
    _previewPath: path,
  };
}

function previewProjectKey(args?: Record<string, unknown>): string {
  const input = (args as { input?: { projectPath?: string } })?.input;
  return String(input?.projectPath ?? "/tmp/PVG/preview.pvg");
}

function makePreviewAsset(
  name: string,
  sourcePath: string,
  mode: MediaImportMode,
): ProjectAssetDto {
  const id = crypto.randomUUID?.() ?? `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const now = new Date().toISOString();
  const lower = name.toLowerCase();
  const kind = lower.match(/\.(png|jpe?g|gif|webp|bmp)$/)
    ? "image"
    : lower.match(/\.(mp3|wav|aac|flac|m4a)$/)
      ? "audio"
      : lower.match(/\.(mp4|mov|mkv|webm|avi)$/)
        ? "video"
        : "other";
  return {
    id,
    kind,
    name,
    relativePath:
      mode === "copy" ? `media/imported/${id}/${name}` : name,
    location:
      mode === "link"
        ? { mode: "link", absolutePath: sourcePath }
        : { mode: "copy", relativePath: `media/imported/${id}/${name}` },
    mimeType: null,
    byteSize: 1_024_000,
    availability: "available",
    fingerprint: null,
    video:
      kind === "video"
        ? {
            width: 1920,
            height: 1080,
            durationMs: 12_000,
            frameRate: 30,
            codec: "h264",
            container: "mp4",
            hasAudio: true,
          }
        : null,
    audio:
      kind === "audio"
        ? { durationMs: 8_000, sampleRate: 48_000, channels: 2, codec: "aac" }
        : null,
    image:
      kind === "image" ? { width: 1080, height: 1080, format: "png" } : null,
    thumbnail: null,
    waveform: null,
    proxy: null,
    binId: null,
    favorite: false,
    createdAt: now,
    updatedAt: now,
  };
}

function pushPreviewJob(
  jobType: JobSnapshot["jobType"],
  assetId?: string | null,
): JobSnapshot {
  const job: JobSnapshot = {
    id: crypto.randomUUID?.() ?? `job-${Date.now()}`,
    jobType,
    state: "queued",
    progress: { stage: "queued", fraction: 0, message: "Browser preview stub" },
    error: null,
    assetId: assetId ?? null,
  };
  previewJobs.unshift(job);
  // Simulate quick completion in preview.
  queueMicrotask(() => {
    const idx = previewJobs.findIndex((j) => j.id === job.id);
    if (idx >= 0) {
      previewJobs[idx] = {
        ...job,
        state: "completed",
        progress: { stage: "done", fraction: 1, message: "Preview complete" },
      };
    }
  });
  return job;
}

/** Deterministic browser/Vite preview fallbacks so UI can be developed without the native shell. */
function browserFallback<T>(cmd: string, args?: Record<string, unknown>): T {
  const now = new Date().toISOString();
  switch (cmd) {
    case "ensure_local_workspace":
      return {
        workspaceId: "ws-local",
        displayName: "Local Test Workspace",
        dataRoot: "/tmp/PVG",
        projectsRoot: "/tmp/PVG/users/local/projects",
        userId: "local",
      } as T;
    case "create_project": {
      const name = String((args as { input?: { name?: string } })?.input?.name ?? "Untitled");
      if (name.includes("..") || name.includes("/") || name.includes("\\")) {
        throw new Error("invalid input: project name contains illegal path characters");
      }
      const path = `/tmp/PVG/users/local/projects/${name.replace(/ /g, "-")}.pvg`;
      const workspaceId = String(
        (args as { input?: { workspaceId?: string } })?.input?.workspaceId ?? "ws-local",
      );
      const description = String(
        (args as { input?: { description?: string } })?.input?.description ?? "",
      );
      const doc = makePreviewDocument(name, path, workspaceId, description);
      previewDocuments.set(path, doc);
      return {
        id: doc.id,
        name,
        path,
        workspaceId,
        schemaVersion: 3,
        createdAt: now,
        updatedAt: now,
        description,
        thumbnailPath: null,
        durationMs: 0,
        trashed: false,
      } as T;
    }
    case "open_project":
    case "read_project_metadata": {
      const path = String((args as { input?: { path?: string } })?.input?.path ?? "");
      let doc = previewDocuments.get(path);
      if (!doc) {
        const name = path.split("/").pop()?.replace(/\.pvg$/i, "") ?? "Preview";
        doc = makePreviewDocument(name, path, "ws-local");
        previewDocuments.set(path, doc);
      }
      return {
        id: doc.id,
        name: doc.name,
        path,
        workspaceId: doc.workspaceId,
        schemaVersion: doc.schemaVersion ?? 3,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        description: doc.description ?? "",
      } as T;
    }
    case "load_project_document": {
      const path = String((args as { input?: { path?: string } })?.input?.path ?? "");
      let doc = previewDocuments.get(path);
      if (!doc) {
        const name = path.split("/").pop()?.replace(/\.pvg$/i, "") ?? "Preview";
        doc = makePreviewDocument(name, path, "ws-local");
        previewDocuments.set(path, doc);
      }
      const { _previewPath: _, ...rest } = doc;
      return rest as T;
    }
    case "save_project": {
      const input = (args as { input?: { path?: string; document?: Record<string, unknown> } })
        ?.input;
      const path = String(input?.path ?? "");
      if (!path.trim()) throw new Error("path is required");
      if (!input?.document) throw new Error("document is required");
      const saved: Record<string, unknown> = {
        ...input.document,
        updatedAt: now,
        lastSavedAt: now,
        _previewPath: path,
      };
      previewDocuments.set(path, saved);
      return {
        id: saved.id,
        name: saved.name,
        path,
        workspaceId: saved.workspaceId,
        schemaVersion: saved.schemaVersion ?? 3,
        createdAt: saved.createdAt,
        updatedAt: now,
        description: saved.description ?? "",
      } as T;
    }

    case "rename_project": {
      const input = (args as { input?: { path?: string; name?: string } })?.input;
      const path = String(input?.path ?? "");
      const name = String(input?.name ?? "").trim();
      if (!path || !name) throw new Error("path and name are required");
      if (name.includes("..") || name.includes("/") || name.includes("\\")) {
        throw new Error("invalid input: project name contains illegal path characters");
      }
      const doc = previewDocuments.get(path) ?? previewTrash.get(path);
      if (!doc) throw new Error(`project not found: ${path}`);
      const nextPath = `/tmp/PVG/users/local/projects/${name.replace(/ /g, "-")}.pvg`;
      const updated: Record<string, unknown> = {
        ...doc,
        name,
        updatedAt: now,
        _previewPath: nextPath,
      };
      previewDocuments.delete(path);
      previewTrash.delete(path);
      previewDocuments.set(nextPath, updated);
      return previewMeta(updated, nextPath, false, now) as T;
    }
    case "duplicate_project": {
      const input = (args as { input?: { path?: string; name?: string } })?.input;
      const path = String(input?.path ?? "");
      const src = previewDocuments.get(path);
      if (!src) throw new Error(`project not found: ${path}`);
      const name = String(input?.name ?? `${String(src.name)} Copy`).trim() || "Copy";
      const nextPath = `/tmp/PVG/users/local/projects/${name.replace(/ /g, "-")}.pvg`;
      const id = crypto.randomUUID?.() ?? `dup-${Date.now()}`;
      const dup: Record<string, unknown> = {
        ...structuredClone(src),
        id,
        name,
        createdAt: now,
        updatedAt: now,
        _previewPath: nextPath,
      };
      previewDocuments.set(nextPath, dup);
      return previewMeta(dup, nextPath, false, now) as T;
    }
    case "trash_project": {
      const path = String((args as { input?: { path?: string } })?.input?.path ?? "");
      const doc = previewDocuments.get(path);
      if (!doc) throw new Error(`project not found: ${path}`);
      previewDocuments.delete(path);
      const trashPath = `/tmp/PVG/users/local/trash/${path.split("/").pop()}`;
      const moved: Record<string, unknown> = { ...doc, _previewPath: trashPath };
      previewTrash.set(trashPath, moved);
      return previewMeta(moved, trashPath, true) as T;
    }
    case "restore_project": {
      const path = String((args as { input?: { path?: string } })?.input?.path ?? "");
      const doc = previewTrash.get(path);
      if (!doc) throw new Error(`project not found: ${path}`);
      previewTrash.delete(path);
      const name = String(doc.name ?? "Restored");
      const nextPath = `/tmp/PVG/users/local/projects/${name.replace(/ /g, "-")}.pvg`;
      const restored: Record<string, unknown> = { ...doc, _previewPath: nextPath };
      previewDocuments.set(nextPath, restored);
      return previewMeta(restored, nextPath, false, now) as T;
    }
    case "delete_project_permanent": {
      const path = String((args as { input?: { path?: string } })?.input?.path ?? "");
      if (!previewTrash.has(path)) {
        throw new Error("permanent delete is only allowed for trashed projects");
      }
      previewTrash.delete(path);
      return true as T;
    }
    case "list_trashed_projects": {
      const projects = [...previewTrash.entries()].map(([p, doc]) =>
        previewMeta(doc, p, true),
      );
      return { workspaceRoot: "/tmp/PVG/users/local/trash", projects } as T;
    }
    case "generate_project_thumbnail": {
      const path = String((args as { input?: { path?: string } })?.input?.path ?? "");
      const doc = previewDocuments.get(path) ?? previewTrash.get(path);
      if (!doc) throw new Error(`project not found: ${path}`);
      const thumb = `preview://thumb/${encodeURIComponent(path)}`;
      doc.thumbnailPath = thumb;
      doc.updatedAt = now;
      return previewMeta(doc, path, previewTrash.has(path), now) as T;
    }

    case "list_workspace_projects": {
      const projects = [...previewDocuments.entries()].map(([path, doc]) => ({
        id: doc.id,
        name: doc.name,
        path,
        workspaceId: doc.workspaceId,
        schemaVersion: doc.schemaVersion ?? 3,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
        description: doc.description ?? "",
      }));
      return {
        workspaceRoot: "/tmp/PVG/users/local/projects",
        projects,
      } as T;
    }
    case "get_diagnostics":
      return {
        appName: "PVG AI",
        appVersion: "0.1.0",
        phase: "4-editor",
        os: "browser-preview",
        arch: "wasm",
        rustcChannel: "n/a",
        dataRoot: "/tmp/PVG",
        workspaceRoot: "/tmp/PVG/users/local/projects",
        connectivityHint: "ONLINE_OPTIONAL",
        vaultBackend: "memory (preview)",
        notes: [
          "Running in browser preview — Tauri commands are mocked",
          "Phase 4 editor — documents/assets/jobs are in-memory stubs",
        ],
      } as T;
    case "vault_list_metadata":
    case "list_provider_metadata": {
      const items: VaultCredentialMeta[] = [];
      for (const [keyId, v] of previewVault) {
        items.push({ keyId, label: v.label, updatedAtMs: Date.now() });
      }
      return (
        cmd === "list_provider_metadata"
          ? items.filter((i) => i.keyId.startsWith("provider."))
          : items
      ) as T;
    }
    case "vault_has_credential": {
      const keyId = String((args as { input?: { keyId?: string } })?.input?.keyId ?? "");
      return previewVault.has(keyId) as T;
    }
    case "save_provider_credential": {
      const input = (args as { input?: { provider?: string; secret?: string; label?: string } })
        ?.input;
      const provider = String(input?.provider ?? "");
      const secret = String(input?.secret ?? "");
      previewVault.set(`provider.${provider}`, {
        secret,
        label: input?.label ?? `Provider ${provider}`,
      });
      return undefined as T;
    }
    case "delete_provider_credential": {
      const provider = String(
        (args as { input?: { provider?: string } })?.input?.provider ?? "",
      );
      return previewVault.delete(`provider.${provider}`) as T;
    }
    case "has_provider_credential": {
      const provider = String(
        (args as { input?: { provider?: string } })?.input?.provider ?? "",
      );
      return previewVault.has(`provider.${provider}`) as T;
    }
    case "store_session_refresh": {
      const token = String(
        (args as { input?: { refreshToken?: string } })?.input?.refreshToken ?? "",
      );
      previewVault.set("session.refresh", { secret: token, label: "Session refresh" });
      return undefined as T;
    }
    case "get_session_refresh":
      return (previewVault.get("session.refresh")?.secret ?? null) as T;
    case "clear_session_refresh":
      return previewVault.delete("session.refresh") as T;
    case "vault_status_cmd":
      return {
        backend: "memory",
        locked: false,
        entryCount: previewVault.size,
      } as T;
    case "vault_lock":
      return undefined as T;
    case "open_external_url":
      return undefined as T;
    case "emit_progress_stub":
      return {
        operationId: "preview",
        stage: "stub",
        percent: 100,
        message: "Browser preview stub",
        done: true,
      } as T;

    // --- Phase 3 media ---
    case "media_probe": {
      const path = String((args as { input?: { path?: string } })?.input?.path ?? "");
      if (!path.trim()) throw new Error("path is required");
      return {
        width: 1920,
        height: 1080,
        durationSecs: 10,
        fps: 30,
        videoCodec: "h264",
        audioCodec: "aac",
        container: "mp4",
        hasVideo: true,
        hasAudio: true,
        isImage: false,
      } satisfies ProbeResult as T;
    }
    case "media_import": {
      const input = (args as {
        input?: { projectPath?: string; sourcePath?: string; mode?: string; name?: string };
      })?.input;
      const projectPath = String(input?.projectPath ?? "");
      const sourcePath = String(input?.sourcePath ?? "");
      const mode = (String(input?.mode ?? "link").toLowerCase() === "copy"
        ? "copy"
        : "link") as MediaImportMode;
      if (!projectPath.trim()) throw new Error("projectPath is required");
      if (!sourcePath.trim()) throw new Error("sourcePath is required");
      const baseName =
        input?.name?.trim() ||
        sourcePath.split(/[/\\]/).pop() ||
        "Imported media";
      const asset = makePreviewAsset(baseName, sourcePath, mode);
      const list = previewAssets.get(projectPath) ?? [];
      list.unshift(asset);
      previewAssets.set(projectPath, list);
      const job = pushPreviewJob("probe", asset.id);
      return { asset, jobIds: [job.id] } satisfies MediaImportResult as T;
    }
    case "media_list_assets": {
      const key = previewProjectKey(args);
      return (previewAssets.get(key) ?? []) as T;
    }
    case "media_remove_asset": {
      const input = (args as { input?: { projectPath?: string; assetId?: string } })?.input;
      const key = String(input?.projectPath ?? "");
      const assetId = String(input?.assetId ?? "");
      const list = (previewAssets.get(key) ?? []).filter((a) => a.id !== assetId);
      previewAssets.set(key, list);
      return { assets: list } as T;
    }
    case "media_relink_asset": {
      const input = (args as {
        input?: { projectPath?: string; assetId?: string; newSourcePath?: string };
      })?.input;
      const key = String(input?.projectPath ?? "");
      const assetId = String(input?.assetId ?? "");
      const newPath = String(input?.newSourcePath ?? "");
      const list = previewAssets.get(key) ?? [];
      const idx = list.findIndex((a) => a.id === assetId);
      if (idx < 0) throw new Error(`asset not found: ${assetId}`);
      const updated: ProjectAssetDto = {
        ...list[idx]!,
        location: { mode: "link", absolutePath: newPath },
        availability: "available",
        updatedAt: now,
      };
      list[idx] = updated;
      previewAssets.set(key, list);
      return updated as T;
    }
    case "media_generate_thumbnail":
    case "media_generate_waveform":
    case "media_generate_proxy": {
      const input = (args as { input?: { assetId?: string } })?.input;
      const jobType =
        cmd === "media_generate_thumbnail"
          ? "thumbnail"
          : cmd === "media_generate_waveform"
            ? "waveform"
            : "proxy";
      return pushPreviewJob(jobType, input?.assetId) as T;
    }
    case "media_list_jobs":
      return [...previewJobs] as T;
    case "media_cancel_job": {
      const jobId = String((args as { input?: { jobId?: string } })?.input?.jobId ?? "");
      const idx = previewJobs.findIndex((j) => j.id === jobId);
      if (idx < 0) throw new Error(`job not found: ${jobId}`);
      const cancelled: JobSnapshot = {
        ...previewJobs[idx]!,
        state: "cancelled",
        progress: { stage: "cancelled", fraction: 0, message: "Cancelled" },
      };
      previewJobs[idx] = cancelled;
      return cancelled as T;
    }
    case "media_storage_summary": {
      const projectPath = previewProjectKey(args);
      const assets = previewAssets.get(projectPath) ?? [];
      const mediaBytes = assets.reduce((n, a) => n + (a.byteSize ?? 0), 0);
      return {
        projectPath,
        totalBytes: mediaBytes,
        mediaBytes,
        proxiesBytes: 0,
        thumbnailsBytes: 0,
        waveformsBytes: 0,
        cacheBytes: 0,
        otherBytes: 0,
      } satisfies StorageSummary as T;
    }
    case "media_resolve_preview": {
      const input = (args as {
        input?: {
          projectPath?: string;
          assetId?: string;
          preferProxy?: boolean;
          forceOriginal?: boolean;
        };
      })?.input;
      const key = String(input?.projectPath ?? "");
      const assetId = String(input?.assetId ?? "");
      const list = previewAssets.get(key) ?? [];
      const asset = list.find((a) => a.id === assetId);
      if (!asset) {
        return {
          absolutePath: null,
          posterPath: null,
          kind: "unknown",
          error: "asset not found",
        } as T;
      }
      return {
        absolutePath: null,
        posterPath: null,
        kind: asset.kind,
        error:
          "Use blob URL from File import in browser preview (disk paths are not served).",
      } as T;
    }
    case "media_export_sequence":
      throw new Error(
        "Export requires the PVG AI Windows desktop app (local FFmpeg).",
      );
    case "media_engine_status":
      return {
        ffmpegAvailable: false,
        ffprobeAvailable: false,
        ffmpegPath: null,
        ffprobePath: null,
        ffmpegVersion: null,
        ffprobeVersion: "browser-preview (stub)",
      } satisfies MediaEngineStatus as T;

    // --- Recovery ---
    case "project_write_autosave": {
      const projectPath = String(
        (args as { input?: { projectPath?: string } })?.input?.projectPath ?? "",
      );
      return {
        path: `${projectPath}/backups/autosave-preview.json`,
        name: "autosave-preview.json",
      } satisfies AutosaveWriteResult as T;
    }
    case "project_list_recovery":
      return [] as AutosaveEntry[] as T;
    case "project_restore_autosave": {
      const path = String(
        (args as { input?: { projectPath?: string } })?.input?.projectPath ?? "",
      );
      return {
        id: "00000000-0000-4000-8000-000000000001",
        name: "Restored",
        path,
        workspaceId: "ws-local",
        schemaVersion: 2,
        createdAt: now,
        updatedAt: now,
        description: "Restored from autosave (preview)",
      } as T;
    }

    default:
      throw new Error(`Command unavailable in browser preview: ${cmd}`);
  }
}

export const nativeApi = {
  ensureLocalWorkspace: () =>
    invokeCommand<LocalWorkspaceInfo>("ensure_local_workspace"),

  listWorkspaceProjects: () =>
    invokeCommand<{ workspaceRoot: string; projects: ProjectMetadata[] }>(
      "list_workspace_projects",
    ),

  listTrashedProjects: () =>
    invokeCommand<{ workspaceRoot: string; projects: ProjectMetadata[] }>(
      "list_trashed_projects",
    ),

  renameProject: (path: string, name: string) =>
    invokeCommand<ProjectMetadata>("rename_project", { input: { path, name } }),

  duplicateProject: (path: string, name?: string) =>
    invokeCommand<ProjectMetadata>("duplicate_project", { input: { path, name } }),

  trashProject: (path: string) =>
    invokeCommand<ProjectMetadata>("trash_project", { input: { path } }),

  restoreProject: (path: string) =>
    invokeCommand<ProjectMetadata>("restore_project", { input: { path } }),

  deleteProjectPermanent: (path: string) =>
    invokeCommand<boolean>("delete_project_permanent", { input: { path } }),

  generateProjectThumbnail: (path: string, sourcePath?: string) =>
    invokeCommand<ProjectMetadata>("generate_project_thumbnail", {
      input: { path, sourcePath },
    }),

  createProject: (input: {
    name: string;
    workspaceId: string;
    description?: string;
  }) => invokeCommand<ProjectMetadata>("create_project", { input }),

  openProject: (path: string) =>
    invokeCommand<ProjectMetadata>("open_project", { input: { path } }),

  loadProjectDocument: (path: string) =>
    invokeCommand<unknown>("load_project_document", { input: { path } }),

  readProjectMetadata: (path: string) =>
    invokeCommand<ProjectMetadata>("read_project_metadata", { input: { path } }),

  saveProject: (path: string, document: unknown) =>
    invokeCommand<ProjectMetadata>("save_project", {
      input: { path, document },
    }),

  getDiagnostics: () => invokeCommand<DiagnosticsReport>("get_diagnostics"),

  vaultHasCredential: (keyId: string) =>
    invokeCommand<boolean>("vault_has_credential", { input: { keyId } }),

  vaultListMetadata: () =>
    invokeCommand<VaultCredentialMeta[]>("vault_list_metadata"),

  saveProviderCredential: (provider: string, secret: string, label?: string) =>
    invokeCommand<void>("save_provider_credential", {
      input: { provider, secret, label },
    }),

  deleteProviderCredential: (provider: string) =>
    invokeCommand<boolean>("delete_provider_credential", {
      input: { provider },
    }),

  hasProviderCredential: (provider: string) =>
    invokeCommand<boolean>("has_provider_credential", {
      input: { provider },
    }),

  listProviderMetadata: () =>
    invokeCommand<VaultCredentialMeta[]>("list_provider_metadata"),

  storeSessionRefresh: (refreshToken: string) =>
    invokeCommand<void>("store_session_refresh", { input: { refreshToken } }),

  getSessionRefresh: () => invokeCommand<string | null>("get_session_refresh"),

  clearSessionRefresh: () => invokeCommand<boolean>("clear_session_refresh"),

  vaultStatus: () =>
    invokeCommand<{ backend: string; locked: boolean; entryCount: number }>(
      "vault_status_cmd",
    ),

  vaultLock: () => invokeCommand<void>("vault_lock"),

  openExternalUrl: async (url: string) => {
    if (isBrowserPreview()) {
      return browserFallback("open_external_url", { input: { url } });
    }
    const { openUrl } = await import("@tauri-apps/plugin-opener");
    await openUrl(url);
  },

  emitProgressStub: (operationId: string) =>
    invokeCommand<ProgressEvent>("emit_progress_stub", {
      input: { operationId },
    }),

  // --- Phase 3 media ---
  mediaProbe: (path: string) =>
    invokeCommand<ProbeResult>("media_probe", { input: { path } }),

  mediaImport: (input: {
    projectPath: string;
    sourcePath: string;
    mode: MediaImportMode;
    name?: string;
  }) => invokeCommand<MediaImportResult>("media_import", { input }),

  mediaListAssets: (projectPath: string) =>
    invokeCommand<ProjectAssetDto[]>("media_list_assets", {
      input: { projectPath },
    }),

  mediaRemoveAsset: (
    projectPath: string,
    assetId: string,
    deleteManagedCopy = false,
  ) =>
    invokeCommand<unknown>("media_remove_asset", {
      input: { projectPath, assetId, deleteManagedCopy },
    }),

  mediaRelinkAsset: (
    projectPath: string,
    assetId: string,
    newSourcePath: string,
  ) =>
    invokeCommand<ProjectAssetDto>("media_relink_asset", {
      input: { projectPath, assetId, newSourcePath },
    }),

  mediaGenerateThumbnail: (projectPath: string, assetId: string) =>
    invokeCommand<JobSnapshot>("media_generate_thumbnail", {
      input: { projectPath, assetId },
    }),

  mediaGenerateWaveform: (projectPath: string, assetId: string) =>
    invokeCommand<JobSnapshot>("media_generate_waveform", {
      input: { projectPath, assetId },
    }),

  mediaGenerateProxy: (
    projectPath: string,
    assetId: string,
    profile?: string,
  ) =>
    invokeCommand<JobSnapshot>("media_generate_proxy", {
      input: { projectPath, assetId, profile },
    }),

  mediaListJobs: () => invokeCommand<JobSnapshot[]>("media_list_jobs"),

  mediaCancelJob: (jobId: string) =>
    invokeCommand<JobSnapshot>("media_cancel_job", { input: { jobId } }),

  mediaStorageSummary: (projectPath: string) =>
    invokeCommand<StorageSummary>("media_storage_summary", {
      input: { projectPath },
    }),

  mediaEngineStatus: () =>
    invokeCommand<MediaEngineStatus>("media_engine_status"),

  mediaResolvePreview: (input: {
    projectPath: string;
    assetId: string;
    preferProxy?: boolean;
    forceOriginal?: boolean;
  }) =>
    invokeCommand<{
      absolutePath: string | null;
      posterPath: string | null;
      kind: string;
      error?: string | null;
    }>("media_resolve_preview", { input }),

  mediaExportSequence: (input: {
    projectPath: string;
    sequenceId: string;
    outputFileName: string;
    preset?: string;
  }) =>
    invokeCommand<{
      outputPath: string;
      durationMs: number;
      width: number;
      height: number;
      clipCount: number;
      videoLayers?: number;
      textLayers?: number;
      audioLayers?: number;
    }>("media_export_sequence", { input }),

  // --- Recovery ---
  projectWriteAutosave: (projectPath: string, document?: unknown) =>
    invokeCommand<AutosaveWriteResult>("project_write_autosave", {
      input: { projectPath, document },
    }),

  projectListRecovery: (projectPath: string) =>
    invokeCommand<AutosaveEntry[]>("project_list_recovery", {
      input: { projectPath },
    }),

  projectRestoreAutosave: (projectPath: string, autosaveName: string) =>
    invokeCommand<ProjectMetadata>("project_restore_autosave", {
      input: { projectPath, autosaveName },
    }),
};
