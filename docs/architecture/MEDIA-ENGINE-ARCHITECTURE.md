# PVG AI — Media Engine Architecture

**Phase:** 3 (Media Foundation)  
**Scope:** Local media import, probe, derivatives, jobs, preview  
**Status:** Design / implementation target for Phase 3  
**Principle:** Local-first; `project.json` is canonical; derivatives are disposable.

---

## 1. Purpose

The media engine turns filesystem media into project-scoped assets with probe metadata, thumbnails, waveforms, and optional proxies — without uploading media to PVG Cloud and without treating derivative files as source of truth.

Phase 3 delivers a **source monitor + media browser** workstation layer. Full multi-track editing, effects, and sequence compositing are **Phase 4+ (deferred)**.

---

## 2. Process Placement

```
┌──────────────────────────────────────────────┐
│  WebView (React)                             │
│  Media browser · Job Center · Preview        │
│  Frame/time display helpers (float seconds)  │
└───────────────────┬──────────────────────────┘
                    │ typed Tauri IPC
┌───────────────────▼──────────────────────────┐
│  Rust native (pvg-media + pvg-core)          │
│  Import · probe · derivative jobs · FS       │
│  FFmpeg/ffprobe via argv arrays only         │
└───────────────────┬──────────────────────────┘
                    │
┌───────────────────▼──────────────────────────┐
│  Local project bundle (*.pvg/)               │
│  project.json + media/ + proxies/ + …        │
└──────────────────────────────────────────────┘
```

- UI never shells out to FFmpeg.
- UI never writes derivative bytes directly into the bundle.
- Cloud API is not on the media I/O path. No automatic upload.

---

## 3. Component Boundaries

| Component | Responsibility | Non-responsibility |
|-----------|----------------|--------------------|
| `@pvg/project-format` | Canonical JSON schema, validate/migrate | Binary I/O, FFmpeg |
| `pvg-core` | Paths, bundle layout, load/save, integrity | Encode/decode |
| `pvg-media` | Probe, thumbnail/waveform/proxy pipelines, FFmpeg discovery | Auth, vault, cloud |
| Job system | Queue, cancel, progress events | Timeline editing |
| Preview (Phase 3) | Path conversion + HTML media element | Sequence compositor |
| Desktop UI | Import UX, browser, Job Center, source monitor | Direct FS outside IPC |

---

## 4. FFmpeg Integration Contract

### Discovery order

1. `PVG_FFMPEG_PATH` / `PVG_FFPROBE_PATH` if set and executable  
2. `ffmpeg` / `ffprobe` on `PATH`  
3. Otherwise: typed “binary unavailable” error; jobs fail cleanly; tests may use mock probe

### Invocation rules (non-negotiable)

- Pass **argv arrays** only (`Command::new(bin).args([...])`).
- **Never** build shell strings, never `sh -c`, never interpolate user paths into a shell.
- Paths are absolute, validated arguments — not concatenated command lines.
- Capture stdout/stderr for diagnostics; scrub secrets (none should appear in media paths from vault).
- Prefer cooperative cancel via kill of the child process when job enters `CANCEL_REQUESTED`.

### Typical uses (Phase 3)

| Operation | Tool | Output location |
|-----------|------|-----------------|
| Probe | ffprobe JSON | In-memory → `project.json` asset fields / local index |
| Thumbnail | ffmpeg | `thumbnails/` |
| Waveform | ffmpeg (or decode+peak) | `waveforms/` |
| Proxy | ffmpeg | `proxies/` |

Derivatives **never overwrite** source files (LINK originals or COPY under `media/imported/` / `media/originals/`).

---

## 5. Time Model

| Layer | Representation | Use |
|-------|----------------|-----|
| Canonical | Frame index + rational timebase / frame rate | Cuts, in/out, probe duration identity |
| Transport | Integer ticks or rational seconds where needed | Job progress, seek targets |
| Display | Float seconds / timecode strings | UI labels only |

Rules:

- Do not use float seconds as identity for edit decisions.
- Round-trip frame ↔ display helpers live in shared TS utilities (+ Rust helpers for native seeks).
- Project settings carry `frameRate` (and related) for conversion context.

---

## 6. Import Pipeline (high level)

```
User pick / DnD
    → validate path (no escape, no execute-on-import)
    → policy: LINK (default) | COPY
    → create media asset record in project.json
    → enqueue PROBE job
    → optionally enqueue THUMBNAIL / WAVEFORM / PROXY
    → UI updates via job progress events
```

See [MEDIA-ASSET-MODEL.md](./MEDIA-ASSET-MODEL.md) for LINK vs COPY and asset fields.  
See [JOB-SYSTEM.md](./JOB-SYSTEM.md) for states and cancel.  
See [PROXY-ARCHITECTURE.md](./PROXY-ARCHITECTURE.md) for profiles `1/2`, `1/4`, `1/8`.

---

## 7. Security Constraints

- Untrusted media: treat as data only; never execute sidecar scripts on import.
- Path validation: reject `..`, symlink escapes outside allowed roots, null bytes.
- No provider secrets in project JSON, job logs, or diagnostics.
- Narrow IPC: typed commands only; no unrestricted FS from the WebView.
- Preserve Phase 1/2 auth isolation: projects under `users/<userId>/`.

---

## 8. Local Indexes vs Canonical Document

| Store | Role | Disposable? |
|-------|------|-------------|
| `project.json` | Source of truth for assets, sequences, settings | **No** |
| Optional `project.db` / asset catalog | Fast search, job history mirror | Yes — rebuildable |
| `cache/` | Transient decode / peek frames | Yes |
| `proxies/`, `thumbnails/`, `waveforms/` | Derivatives | Yes (regenerable) |

Indexes must not silently diverge into a second competing schema. If conflict: trust `project.json`, rebuild index.

---

## 9. Deferred (Phase 4+)

- Multi-track timeline editor, transitions, effects, color, VFX
- Sequence compositor / WebCodecs preview pipeline
- Hardware encode selection UX beyond detection foundation (NVENC/QSV/AMF)
- Cloud media sync / remote proxies
- AI generation ingest as first-class generated assets beyond local files

---

## 10. Related Documents

- [MEDIA-ASSET-MODEL.md](./MEDIA-ASSET-MODEL.md)
- [PROXY-ARCHITECTURE.md](./PROXY-ARCHITECTURE.md)
- [JOB-SYSTEM.md](./JOB-SYSTEM.md)
- [PREVIEW-ARCHITECTURE.md](./PREVIEW-ARCHITECTURE.md)
- [PROJECT-LIFECYCLE.md](./PROJECT-LIFECYCLE.md)
- [STORAGE-ARCHITECTURE.md](./STORAGE-ARCHITECTURE.md)
- [../project-format/PROJECT-FORMAT.md](../project-format/PROJECT-FORMAT.md)
