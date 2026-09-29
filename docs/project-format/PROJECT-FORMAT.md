# PVG AI Project Format

**Canonical file:** `project.json` inside a `.pvg` bundle  
**Current schema:** `CURRENT_PROJECT_SCHEMA_VERSION = 2`  
**Migration:** v1 → v2 required on open of older projects  

Indexes, SQLite catalogs, and derivative caches are **disposable**. They must not compete with `project.json` as source of truth.

---

## Bundle Layout

```
MyProject.pvg/
  project.json           # CANONICAL source of truth
  project.db             # optional local index (rebuildable)
  media/
    imported/            # COPY-policy media
    originals/           # project-owned masters
  proxies/               # 1/2, 1/4, 1/8 profiles
  thumbnails/
  waveforms/
  cache/                 # temps / disposable
  renders/
  backups/               # autosave + crash recovery snapshots
```

### Directory roles

| Path | Role | Overwrite source? |
|------|------|-------------------|
| `media/imported/` | Bytes owned by project after COPY import | N/A (is project copy) |
| `media/originals/` | Project-owned masters (non-link) | N/A |
| `proxies/` | Working proxies | **Never** overwrites masters |
| `thumbnails/`, `waveforms/` | Derivatives | **Never** overwrites masters |
| `cache/` | In-flight / peek | Disposable |
| `renders/` | Export outputs | Separate from masters |
| `backups/` | JSON snapshots for recovery | Retention must preserve last-good |

Generated media is **not** the source of truth. `project.json` is.

Legacy v1 dirs (`assets/`, `generated/`, `audio/`, `captions/`) are read during migration and mapped into the v2 layout / asset model; new writes use the layout above.

---

## Source Policy (LINK vs COPY)

| Policy | Default | Behavior |
|--------|---------|----------|
| **LINK** | **Yes** | Reference absolute `originalPath` + fingerprint; no copy into bundle |
| **COPY** | Opt-in | Copy into `media/imported/<assetId>/…`; `relativePath` is authoritative for bytes |

- Derivatives always write under `proxies/` / `thumbnails/` / `waveforms/` / `cache/` — never onto LINK originals or imported masters as in-place replaces.  
- Missing LINK targets → asset `MISSING`; relink updates path/fingerprint.  
- Local-first: **no automatic cloud upload** of media or `project.json`.

---

## Schema Versioning

```
CURRENT_PROJECT_SCHEMA_VERSION = 2
```

| Rule | Detail |
|------|--------|
| Probe | Read `schemaVersion` before full validate |
| Upgrade | `migrateProject(data, targetVersion)` via sequential registry |
| v1 → v2 | Mandatory path registered; bumps version by exactly +1 |
| Unknown / newer | `UnsupportedSchemaVersion` — no silent reinterpretation |
| Result | Caller persists migrated document with safe save (see lifecycle) |

Migrations must know `source_version`, `target_version`, and result.

### v1 → v2 migration (behavioral contract)

1. Accept valid v1 documents (`assets`, `timeline` stub, `settings`, …).  
2. Set `schemaVersion: 2`.  
3. Map assets into v2 media asset fields (`sourcePolicy` default `COPY` when `relativePath` present under legacy `assets/`, else treat as in-bundle; external refs become `LINK` when absolute provenance exists).  
4. Introduce `bins` (may be empty) and `sequences` foundation (may seed one empty sequence from project settings; map `timeline` stub into sequence-compatible structure or preserve under sequence metadata without claiming full NLE).  
5. Ensure bundle directory expectations are documented for create/open (engine creates missing derivative dirs).  
6. Validate with v2 schema + integrity; on failure, abort migration — do not write corrupt v2 over last-good.

Exact field mapping lives in `@pvg/project-format` migration code; this document is the behavioral contract.

### v2 → v3 migration (Phase 4)

1. Accept valid v2 documents.  
2. Set `schemaVersion: 3`.  
3. Ensure sequences have `sampleRate`, `backgroundColor`, `markers`.  
4. Expand tracks with `solo`, `visible`, `height`, `colorLabel`.  
5. Expand clips with editor fields (kind, speed, transform, keyframes, effects, transitions, text/shape, mask, blendMode, …) using safe defaults — **never drop** existing clip timing/asset refs.  
6. Validate with v3 schema + integrity.

Canonical current version: **3** (`CURRENT_PROJECT_SCHEMA_VERSION`).

---

## Canonical `project.json` (v2)

Logical document (TypeScript/Zod and Rust must round-trip the same JSON):

```json
{
  "id": "uuid",
  "name": "string",
  "schemaVersion": 2,
  "workspaceId": "uuid",
  "createdAt": "ISO-8601",
  "updatedAt": "ISO-8601",
  "settings": {
    "frameRate": 30,
    "width": 1920,
    "height": 1080,
    "sampleRate": 48000,
    "locale": "en-US",
    "defaultImportPolicy": "LINK",
    "defaultProxyProfile": "quarter"
  },
  "bins": [
    { "id": "uuid", "name": "string", "parentId": null }
  ],
  "assets": [
    {
      "id": "uuid",
      "name": "string",
      "kind": "video",
      "sourcePolicy": "LINK",
      "originalPath": "/absolute/path/or/null",
      "relativePath": "media/imported/…/or/null",
      "fingerprint": {
        "byteSize": 0,
        "mtimeMs": 0,
        "contentHash": null
      },
      "mimeType": null,
      "probe": null,
      "binId": null,
      "tags": [],
      "status": "READY",
      "proxyProfile": "quarter",
      "derivatives": [],
      "createdAt": "ISO-8601",
      "updatedAt": "ISO-8601"
    }
  ],
  "sequences": [
    {
      "id": "uuid",
      "name": "Sequence 1",
      "frameRate": 30,
      "width": 1920,
      "height": 1080,
      "durationFrames": 0,
      "clips": []
    }
  ]
}
```

### Sequences foundation

- Persistable sequences with settings + `clips` array.  
- Phase 3: empty or minimal clip refs only — **not** a full timeline editor.  
- Multi-track editing, effects, compositor: **Phase 4+ (deferred)**.

### Time

- Durations and edit points: frame-accurate fields / utilities.  
- Float seconds: display layer only (preview adapters, labels).

### Derivatives (inline or referenced)

Each derivative: `id`, `role` (`thumbnail` \| `waveform` \| `proxy`), `relativePath`, `profile` (proxies: `half` \| `quarter` \| `eighth`), `status`, `createdAt`.

---

## API

- `validateProject(data)`
- `loadProject(path | data)` — migrate then validate
- `saveProject(path, data)` — validate then write
- `migrateProject(data, targetVersion)`

Typed errors: `ProjectCorrupt`, `ProjectInvalid`, `UnsupportedSchemaVersion`, `MissingReference`, `DuplicateId`.

---

## Integrity Checks

- Corrupted / non-JSON `project.json`
- Invalid schema
- Missing references (bin, sourceAsset, clip → asset)
- Duplicate IDs
- Invalid timestamps
- Invalid asset paths (relative path rules; LINK absolute when required)
- Unsupported schema version
- Derivative `relativePath` escaping bundle rules

Corrupted projects are **not** auto-deleted; diagnostics are returned. Recovery uses `backups/` and must not silently overwrite last-good with invalid data.

---

## Crash Recovery

- Autosave snapshots under `backups/`.  
- Open path: if canonical JSON corrupt, restore from newest valid backup via validate → atomic replace.  
- Never silently overwrite the last-good backup with a failed autosave candidate.

See [../architecture/PROJECT-LIFECYCLE.md](../architecture/PROJECT-LIFECYCLE.md) and [../architecture/STORAGE-ARCHITECTURE.md](../architecture/STORAGE-ARCHITECTURE.md).

---

## Related Architecture

- [../architecture/MEDIA-ENGINE-ARCHITECTURE.md](../architecture/MEDIA-ENGINE-ARCHITECTURE.md)
- [../architecture/MEDIA-ASSET-MODEL.md](../architecture/MEDIA-ASSET-MODEL.md)
- [../architecture/PROXY-ARCHITECTURE.md](../architecture/PROXY-ARCHITECTURE.md)
- [../architecture/JOB-SYSTEM.md](../architecture/JOB-SYSTEM.md)
- [../architecture/PREVIEW-ARCHITECTURE.md](../architecture/PREVIEW-ARCHITECTURE.md)
