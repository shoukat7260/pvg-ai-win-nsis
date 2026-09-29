# PVG AI — Media Asset Model

**Phase:** 3  
**Canonical store:** `project.json` (`schemaVersion: 2`)  
**Default import policy:** `LINK`

---

## 1. Asset Identity

Every media item in a project is a **MediaAsset** with a stable UUID. Derivatives (proxy, thumbnail, waveform) reference the source asset; they do not replace it.

```
MediaAsset (source)
  ├── ProxyDerivative(s)     → proxies/<assetId>/<profile>/…
  ├── ThumbnailDerivative    → thumbnails/<assetId>/…
  └── WaveformDerivative     → waveforms/<assetId>/…
```

Derivatives **never overwrite** source bytes.

---

## 2. Source Policy: LINK vs COPY

| Policy | Behavior | When |
|--------|----------|------|
| **LINK** (default) | Project stores absolute path + fingerprint; file stays where the user put it | Normal import |
| **COPY** | Bytes copied into bundle under `media/imported/` (and tracked as project-owned) | User opts in; offline portability |

### LINK rules

- Record `sourcePolicy: "LINK"`.
- Store `originalPath` (absolute, platform-native) after validation.
- Store fingerprint fields for missing-media / relink: size, mtime, optional content hash.
- Do **not** copy into the bundle on import.
- Offline open: if path missing → asset status `MISSING`; offer relink (user picks new path; update record; re-verify fingerprint optionally).

### COPY rules

- Record `sourcePolicy: "COPY"`.
- Copy into `media/imported/<assetId>/<safeFileName>`.
- `relativePath` inside the bundle is canonical for that copy.
- Optionally retain `originalPath` as provenance only (not required for playback).
- Subsequent edits to the user’s original file outside the project do not affect the copy.

### `media/originals/`

Reserved for project-owned masters that are not “imported references” — e.g. captured or generated masters that the project owns. Phase 3 may leave this empty; layout must exist. Do not use `originals/` as a silent rewrite of LINK sources.

---

## 3. Canonical Fields (schema v2)

Logical shape (names may map 1:1 to Zod/Rust types):

| Field | Required | Notes |
|-------|----------|-------|
| `id` | yes | UUID |
| `name` | yes | Display name |
| `kind` | yes | `video` \| `audio` \| `image` \| `caption` \| `other` |
| `sourcePolicy` | yes | `LINK` \| `COPY` |
| `originalPath` | LINK: yes | Absolute path; null for pure COPY if unused |
| `relativePath` | COPY / in-bundle | Relative path under bundle; null for LINK-only until copy |
| `fingerprint` | yes | `{ byteSize, mtimeMs?, contentHash? }` |
| `mimeType` | optional | From probe / extension |
| `probe` | optional | Duration (frame-accurate), streams, codec, resolution, sampleRate, … |
| `binId` | optional | Media browser bin |
| `tags` | optional | Search tags |
| `status` | yes | `READY` \| `MISSING` \| `OFFLINE` \| `PROCESSING` \| `ERROR` |
| `proxyProfile` | optional | Active proxy preference: `half` \| `quarter` \| `eighth` \| `none` |
| `createdAt` / `updatedAt` | yes | ISO-8601 with offset |

Probe duration and edit points use **frame-accurate** utilities. Float seconds appear only in UI display helpers.

---

## 4. Derivative Records

Derivatives may be listed under the asset or as sibling assets with `sourceAssetId` / `role`:

| Role | Bundle path | Disposable |
|------|-------------|------------|
| `thumbnail` | `thumbnails/` | yes |
| `waveform` | `waveforms/` | yes |
| `proxy` | `proxies/` | yes |

Each derivative record includes: `id`, `sourceAssetId`, `role`, `relativePath`, `profile` (for proxies), `byteSize`, `createdAt`, `status`.

Regeneration replaces the derivative file/path, never the source.

---

## 5. Bins, Search, Missing Media

- **Bins:** folders in the media browser; stored as ids/names in `project.json` (or `bins[]` array). Moving an asset between bins is metadata-only.
- **Search:** name, tags, kind, codec — served from canonical list or rebuildable local index.
- **Missing media:** LINK path gone or fingerprint mismatch → `MISSING`. Playback blocked until relink or user chooses COPY from new location.
- **Relink:** updates `originalPath` + fingerprint; may re-enqueue probe if streams changed.

---

## 6. Sequences Foundation (not full editor)

Schema v2 includes a **sequences** collection sufficient to persist empty/basic sequences and later attach clips:

| Field | Notes |
|-------|-------|
| `id`, `name` | Identity |
| `frameRate`, `width`, `height` | Sequence settings (may inherit project defaults) |
| `clips` | Minimal array; Phase 3 may be empty or simple source references |
| `durationFrames` | Frame-accurate length |

This is **not** a multi-track NLE. Timeline editing UX, transitions, and compositor are **Phase 4+ (deferred)**. The Phase 1 `timeline` stub migrates into or alongside sequences during v1→v2 (see project format doc).

---

## 7. What Must Not Live on the Asset

- Provider API keys / vault secrets  
- Cloud upload URLs as required fields  
- Absolute paths to derivative caches outside the bundle (prefer relative)  
- Float-only exclusive duration as the only time field  

---

## 8. Related Documents

- [MEDIA-ENGINE-ARCHITECTURE.md](./MEDIA-ENGINE-ARCHITECTURE.md)
- [PROXY-ARCHITECTURE.md](./PROXY-ARCHITECTURE.md)
- [STORAGE-ARCHITECTURE.md](./STORAGE-ARCHITECTURE.md)
- [../project-format/PROJECT-FORMAT.md](../project-format/PROJECT-FORMAT.md)
