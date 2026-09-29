# PVG AI — Project Lifecycle

**Phase:** 3 extends Phase 1 project open/save  
**Canonical document:** `project.json`  
**Schema:** `CURRENT_PROJECT_SCHEMA_VERSION = 2` (migrate v1 → v2)

---

## 1. Lifecycle Overview

```
Create → Open → (Autosave / Explicit Save)* → Close
                 ↘ Crash / Kill → Recovery on next Open
```

All creative structure for the project lives in the local `.pvg` bundle. Cloud rows (if any) are metadata indexes only — **no automatic media upload**.

---

## 2. Create

1. Validate name + parent directory under `users/<userId>/projects/` (or allowed roots).  
2. Create bundle directories (see [STORAGE-ARCHITECTURE.md](./STORAGE-ARCHITECTURE.md) / project format).  
3. Write `project.json` at schema v2 with empty `assets`, foundation `sequences`, defaults.  
4. Optional empty index DB.  
5. Return metadata to UI; do not upload.

---

## 3. Open

1. Resolve path; enforce user scope.  
2. Acquire project lock (single-writer). If lock held → typed error (do not corrupt).  
3. Read `project.json`; probe `schemaVersion`.  
4. If v1 → run migration to v2 (see project format); write migrated document via safe save.  
5. Validate + integrity checks (`validateProject`).  
6. Rebuild disposable indexes if missing/stale.  
7. Scan LINK assets for missing paths → mark `MISSING` without deleting records.  
8. Emit opened state to UI.

Corrupted JSON → `ProjectCorrupt`; **do not auto-delete** the bundle. Prefer recovery from `backups/`.

---

## 4. Save

### Explicit save

1. Validate in-memory document.  
2. Write to temp file in bundle (`project.json.tmp` or under `cache/`).  
3. Fsync as appropriate.  
4. Atomic rename over `project.json`.  
5. Update `updatedAt`.  
6. Optionally rotate a backup copy into `backups/` (see §6).

### Autosave

- Periodic or dirty-debounced.  
- Same atomic write rules.  
- Autosave backups go under `backups/` with timestamps.  
- **Never silently overwrite the last-good backup** when the current document fails validation or looks corrupt.

---

## 5. Close

1. Flush dirty state (or prompt).  
2. Stop/cancel project-scoped jobs (`CANCEL_REQUESTED` → drain).  
3. Release lock.  
4. Drop preview backends / converted URL grants as needed.

---

## 6. Crash Recovery & Backups

Layout:

```
MyProject.pvg/
  project.json           # last successful canonical write
  backups/
    project-20260929T120000Z.json
    project-autosave-….json
    … retention policy …
```

Rules:

- On open after crash: if `project.json` invalid, offer restore from newest **valid** backup.  
- Restoring must copy backup → temp → validate → atomic replace `project.json`.  
- Retention: keep N timestamped backups; prune oldest **after** confirming newer valid copies exist.  
- Never delete the only remaining last-good when pruning.  
- Derivatives and `cache/` are not recovery sources for project structure.

---

## 7. Migration Gate (v1 → v2)

Open path always goes through:

```
load → migrateProject(…, target=2) → validate → save if migrated
```

Migration must record `source_version`, `target_version`, and result. No silent reinterpretation of unknown versions. Newer-than-supported → `UnsupportedSchemaVersion`.

Details: [../project-format/PROJECT-FORMAT.md](../project-format/PROJECT-FORMAT.md).

---

## 8. Concurrency & Locking

- One writer per project bundle (file lock or lockfile under bundle).  
- Second open: fail clearly.  
- Job workers coordinate through the job system; they do not write `project.json` without the project controller’s save path (or a single serialized writer).

---

## 9. Sequences Foundation

- Open/save persists `sequences[]` (may be empty).  
- Creating a default empty sequence on new projects is allowed.  
- Full timeline editing is **Phase 4+ (deferred)** — lifecycle only guarantees durable persistence of the foundation model.

---

## 10. Related Documents

- [../project-format/PROJECT-FORMAT.md](../project-format/PROJECT-FORMAT.md)
- [STORAGE-ARCHITECTURE.md](./STORAGE-ARCHITECTURE.md)
- [JOB-SYSTEM.md](./JOB-SYSTEM.md)
- [MEDIA-ASSET-MODEL.md](./MEDIA-ASSET-MODEL.md)
