# PVG AI — Proxy Architecture

**Phase:** 3  
**Profiles:** `1/2` (half), `1/4` (quarter), `1/8` (eighth)  
**Default source policy interaction:** Proxies are derivatives of LINK or COPY sources; never replace them.

---

## 1. Goals

- Keep preview/scrub responsive on large masters without mutating originals.
- Store proxies inside the project bundle under `proxies/`.
- Make proxies regenerable and disposable; `project.json` remains canonical.

---

## 2. Profiles

| Profile id | Scale | Typical use |
|------------|-------|-------------|
| `half` | 1/2 | Better quality scrub / large monitors |
| `quarter` | 1/4 | Default working proxy (balanced) |
| `eighth` | 1/8 | Fast browse / weak GPUs |

Scale applies to frame dimensions (even dimensions enforced for codec constraints). Audio may be remuxed or lightly re-encoded for sync; exact encode presets live in `pvg-media` config, not in marketing copy.

Project/user preference selects which profile is “active” for preview when available. Missing proxy → fall back to source if playable, or show “generate proxy” affordance.

---

## 3. On-Disk Layout

```
MyProject.pvg/
  proxies/
    <assetId>/
      half/
        proxy.mp4          # or container chosen by encoder
        meta.json          # optional: encode settings, source fingerprint
      quarter/
        …
      eighth/
        …
```

Rules:

- Path segments use asset UUID — no user-controlled path traversal.
- One directory per profile; regenerate replaces files in that profile dir only.
- **Never** write proxy output over `media/imported/`, `media/originals/`, or LINK originals.

---

## 4. Generation Pipeline

```
Enqueue PROXY job (assetId, profile)
  → resolve source path (LINK absolute or COPY relative)
  → verify fingerprint / existence
  → ffmpeg argv: scale + encode to temp file under cache/
  → atomic rename into proxies/<assetId>/<profile>/
  → update asset derivative record in project.json (or index + dirty flag → save)
  → emit COMPLETED (or FAILED / CANCELLED)
```

- Temp files live under `cache/`; cleaned on success or cancel.
- Cooperative cancel: `CANCEL_REQUESTED` → kill ffmpeg child → delete incomplete temp → `CANCELLED`.
- Disk-full: fail job with typed storage error; do not truncate last-good proxy silently mid-write (atomic replace).

---

## 5. FFmpeg Constraints

- Argv arrays only; discover binary via `PVG_FFMPEG_PATH` then `PATH`.
- No shell interpolation of paths.
- Profile encode settings are fixed templates + validated integers (width/height), not free-form user command strings.

Hardware encoders (NVENC/QSV/AMF): **detection foundation only** in Phase 3; selection UX and guaranteed hardware paths are **Phase 4+ (deferred)**. Software encode is the reliable default.

---

## 6. Preview Binding

Preview prefers:

1. Active proxy profile file if `READY`  
2. Else source (LINK/COPY) if container is HTML-media-playable  
3. Else placeholder + “Generate proxy” / “Unsupported for preview”

See [PREVIEW-ARCHITECTURE.md](./PREVIEW-ARCHITECTURE.md).

---

## 7. Invalidation

Regenerate or mark stale when:

- Source fingerprint changes after relink  
- User explicitly “Rebuild proxies”  
- Profile settings version bump in engine config  

Stale proxies may remain on disk until replaced; playback should not use a proxy whose recorded source fingerprint disagrees with the asset.

---

## 8. Deferred (Phase 4+)

- Optimized mezzanine codecs / ProRes / DNx per platform packager  
- Shared proxy cache across projects  
- Cloud-generated proxies  
- Automatic profile ladder based on realtime telemetry  

---

## 9. Related Documents

- [MEDIA-ENGINE-ARCHITECTURE.md](./MEDIA-ENGINE-ARCHITECTURE.md)
- [MEDIA-ASSET-MODEL.md](./MEDIA-ASSET-MODEL.md)
- [JOB-SYSTEM.md](./JOB-SYSTEM.md)
- [STORAGE-ARCHITECTURE.md](./STORAGE-ARCHITECTURE.md)
