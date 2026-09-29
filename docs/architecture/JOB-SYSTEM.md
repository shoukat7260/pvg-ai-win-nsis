# PVG AI — Job System

**Phase:** 3  
**Runtime:** Rust worker pool in the desktop native process  
**UI:** Job Center + `pvg://progress` (or successor) events  

---

## 1. Purpose

Long-running media work (probe, thumbnail, waveform, proxy, future render) runs off the UI thread with progress, pause where safe, and cooperative cancel.

Jobs are **local** to the machine and project. They are not submitted to PVG Cloud. No automatic media upload.

---

## 2. Job States

Canonical state machine:

```
                 ┌──────────┐
                 │  QUEUED  │
                 └────┬─────┘
                      │ start
                      ▼
                 ┌──────────┐  pause   ┌─────────┐
            ┌───►│ RUNNING  │─────────►│ PAUSED  │──┐
            │    └────┬─────┘◄─────────└─────────┘  │
            │         │ resume                       │
            │         │                              │
            │         │ success                      │
            │         ▼                              │
            │    ┌──────────┐                        │
            │    │COMPLETED │                        │
            │    └──────────┘                        │
            │                                        │
            │    fail                                │
            │         ┌──────────┐                   │
            │         │  FAILED  │                   │
            │         └──────────┘                   │
            │                                        │
 cancel     │    ┌──────────────────┐                │
 request    └───►│ CANCEL_REQUESTED │◄───────────────┘
                 └────────┬─────────┘
                          │ cleanup done
                          ▼
                     ┌──────────┐
                     │CANCELLED │
                     └──────────┘
```

| State | Meaning |
|-------|---------|
| `QUEUED` | Accepted; waiting for a worker |
| `RUNNING` | Worker actively processing |
| `PAUSED` | Cooperative pause (supported job types only); resources may be released |
| `COMPLETED` | Success; outputs committed |
| `FAILED` | Terminal error; typed reason; outputs not committed as success |
| `CANCEL_REQUESTED` | User/system asked to stop; worker must wind down |
| `CANCELLED` | Cancel finished; temps cleaned |

Illegal transitions (e.g. `COMPLETED` → `RUNNING`) are rejected.

---

## 3. Job Types (Phase 3)

| Type | Inputs | Outputs |
|------|--------|---------|
| `PROBE` | asset id / path | probe metadata → project |
| `THUMBNAIL` | asset id | `thumbnails/` |
| `WAVEFORM` | asset id | `waveforms/` |
| `PROXY` | asset id + profile (`half`\|`quarter`\|`eighth`) | `proxies/` |

Future: `RENDER`, `TRANSCODE`, AI jobs — **Phase 4+ (deferred)** for full pipelines.

---

## 4. Job Record

| Field | Notes |
|-------|-------|
| `id` | UUID |
| `type` | enum above |
| `projectId` | scope |
| `assetId` | when applicable |
| `state` | see §2 |
| `progress` | 0–1 or frame counters (prefer integers / rationals over float identity) |
| `message` | safe user-facing status |
| `error` | typed code + message on `FAILED` |
| `createdAt` / `startedAt` / `finishedAt` | timestamps |
| `cancelable` | bool |
| `pausable` | bool |

Persistence: job history may live in a disposable local index (`project.db` / jobs log). **Do not** treat job history as a second project schema. Active work can also be in-memory + event stream.

---

## 5. Worker Pool

- Bounded concurrency (CPU/disk aware; configurable).
- Per-project or global queue with fair scheduling.
- FFmpeg children spawned with argv arrays only (`PVG_FFMPEG_PATH` / `PATH`).
- On `CANCEL_REQUESTED`: signal/kill child; delete temp outputs under `cache/`; transition to `CANCELLED`.
- On crash of worker process: mark in-flight jobs `FAILED` or re-queue with explicit recovery policy — never leave UI thinking a dead job is still `RUNNING` without heartbeat timeout.

---

## 6. Progress Events

Native → UI:

```
JobEvent {
  jobId, projectId, type, state,
  progress, message, updatedAt
}
```

UI Job Center lists active + recent jobs; supports Cancel (→ `CANCEL_REQUESTED`) and Pause/Resume when `pausable`.

---

## 7. Failure & Idempotency

- Failed jobs do not delete source media.
- Partial derivative writes use temp + atomic rename; failure leaves previous good derivative intact.
- Re-run of the same job type/profile is idempotent at the path level (overwrite derivative only).

---

## 8. Security

- Job payloads never include vault secrets.
- Paths validated before enqueue.
- No arbitrary command job type.

---

## 9. Related Documents

- [MEDIA-ENGINE-ARCHITECTURE.md](./MEDIA-ENGINE-ARCHITECTURE.md)
- [PROXY-ARCHITECTURE.md](./PROXY-ARCHITECTURE.md)
- [PROJECT-LIFECYCLE.md](./PROJECT-LIFECYCLE.md)
