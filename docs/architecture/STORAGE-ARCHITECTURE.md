# PVG AI — Storage Architecture

**Phase:** 3  
**Principle:** Local-first; `project.json` canonical; indexes/caches disposable  
**Cloud:** No automatic media upload

---

## 1. Workspace Roots

Desktop data stays under the authenticated user scope:

```
PVG/
  users/
    <userId>/
      projects/          # *.pvg bundles
      cache/             # user-global disposable (optional)
      backups/           # optional user-level backups
      metadata/
```

Project-owned media and derivatives live **inside** each `.pvg` bundle unless LINK points outside (reference only).

---

## 2. Project Bundle Layout (schema v2)

```
MyProject.pvg/
  project.json           # CANONICAL source of truth
  project.db             # optional local index (disposable)
  media/
    imported/            # COPY-policy imports
    originals/           # project-owned masters (non-link)
  proxies/               # scale profiles 1/2, 1/4, 1/8
  thumbnails/
  waveforms/
  cache/                 # temps, peek frames, in-flight encodes
  renders/               # export outputs (Phase 3 may be unused)
  backups/               # autosave / crash-recovery JSON snapshots
```

Legacy Phase 1 dirs (`assets/`, `generated/`, `audio/`, `captions/`) migrate or map during v1→v2; new code writes the layout above.

---

## 3. What Is Disposable

| Path | Disposable | Rebuild |
|------|------------|---------|
| `project.json` | **No** | Restore from `backups/` only |
| `backups/` | Partially (retention) | Never prune last-good |
| `media/imported/`, `media/originals/` | **No** (user data) | User restore |
| LINK originals outside bundle | N/A | Relink |
| `proxies/`, `thumbnails/`, `waveforms/` | Yes | Jobs |
| `cache/` | Yes | Delete anytime |
| `project.db` / indexes | Yes | Rebuild from `project.json` + FS scan |
| `renders/` | User outputs; treat as valuable | Not auto-deleted by cache purge |

---

## 4. Write Rules

1. **Derivatives never overwrite source** (LINK path or `media/**` masters).  
2. Encode/copy to temp under `cache/` (or sibling `.tmp`), then **atomic rename** into place.  
3. `project.json` updates: temp + validate + atomic rename.  
4. Autosave backups under `backups/`; **never silently overwrite last-good** when the candidate is corrupt/invalid.  
5. FFmpeg outputs follow the same temp→rename pattern.

---

## 5. Disk Space

- Before large COPY import or PROXY jobs: check free space; fail early with typed `StorageFull` / warning.  
- UI may show project disk usage = sum of bundle dirs (exclude LINK externals).  
- Cache purge command: delete `cache/` and optionally regenerable derivatives; never delete `media/**` or `project.json`.

---

## 6. Path Security

- Relative paths in JSON: no `..`, no absolute, no `\`-traversal, no NUL.  
- Absolute LINK paths: canonicalize; reject escapes from allowed import roots if policy enabled.  
- Symlinks: resolve and ensure final target is allowed; do not follow into unexpected roots for writes.  
- Asset/cache IDs are UUIDs in path segments — never raw user filenames as sole directory keys without sanitization.

---

## 7. Indexes vs Canonical

```
project.json  ──►  rebuild  ──►  project.db / search index
     ▲                                  │
     │                                  │ must not invent assets
     └──────── conflict? trust JSON ────┘
```

Jobs may update index rows for speed, but durable asset membership and sequence structure commit through `project.json` save.

---

## 8. Renders & Exports

`renders/` holds export products. Phase 3 may only create the directory. Full render pipeline is **Phase 4+ (deferred)** where overlapping with NLE export; any early export still must not upload automatically.

---

## 9. Cloud Boundary

| Local | Cloud (optional metadata) |
|-------|---------------------------|
| Media bytes | Not stored by default |
| Proxies / thumbs / waveforms | Not stored by default |
| `project.json` | Optional future sync — explicit opt-in later |
| Vault secrets | Never in project storage |

---

## 10. Related Documents

- [../project-format/PROJECT-FORMAT.md](../project-format/PROJECT-FORMAT.md)
- [PROJECT-LIFECYCLE.md](./PROJECT-LIFECYCLE.md)
- [MEDIA-ASSET-MODEL.md](./MEDIA-ASSET-MODEL.md)
- [PROXY-ARCHITECTURE.md](./PROXY-ARCHITECTURE.md)
- [MEDIA-ENGINE-ARCHITECTURE.md](./MEDIA-ENGINE-ARCHITECTURE.md)
