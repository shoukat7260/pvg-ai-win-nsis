# PVG AI — API Conventions (`/api/v1`)

**Phase:** 1  
**Status:** PENDING USER ACCEPTANCE

---

## 1. Versioning

- All HTTP JSON APIs live under the prefix **`/api/v1`**.
- The version is part of the URL path (not a header). Breaking changes require `/api/v2` (or later) — do not silently change v1 contracts.
- Additive, backwards-compatible fields may be introduced in v1 when documented.
- Health endpoints used by clients also sit under `/api/v1` (`/health`, `/ready`) so the typed client shares one base path.

Non-goals for Phase 1: GraphQL, WebSocket RPC, unversioned `/api` aliases.

---

## 2. Request identity & correlation

| Header | Direction | Purpose |
|--------|-----------|---------|
| `X-Request-Id` | Client → API | Correlation id; client should generate a UUID when absent |
| `X-Request-Id` | API → Client | Echo or server-assigned id for logs and error bodies |
| `Authorization` | Client → API | `Bearer <token>` when authenticated (Phase 2 flows) |
| `Accept` | Client → API | `application/json` |
| `Content-Type` | Client → API | `application/json` for bodies |

Clients **must** propagate `request_id` into structured errors so UI and support can correlate desktop logs with API logs.

Identity for authorization comes **only** from the authenticated session/token — never from client-supplied `user_id` / `workspace_id` / `owner_id` fields in the body.

---

## 3. Error format

Failed responses return JSON with a consistent shape (flat body or `{ "error": { ... } }` envelope — clients accept both):

```json
{
  "code": "not_found",
  "message": "Project not found",
  "details": [
    { "field": "project_id", "code": "uuid", "message": "Invalid UUID" }
  ],
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

| Field | Required | Notes |
|-------|----------|-------|
| `code` | yes | Machine-readable snake_case / dotted code |
| `message` | yes | Safe for UI display (no secrets, no stack traces) |
| `details` | no | Field-level validation issues |
| `request_id` | yes | Matches `X-Request-Id` when possible |

Typed TypeScript shape: `ApiError` in `@pvg/types`. Zod mirror: `ApiErrorSchema` in `@pvg/schemas`. Client helper: `parseApiError` / `ApiClientError` in `@pvg/api-client`.

### Common codes (foundation)

| HTTP | `code` | Meaning |
|------|--------|---------|
| 400 | `validation_error` | Request body/query failed validation |
| 401 | `unauthorized` | Missing/invalid credentials |
| 403 | `forbidden` | Authenticated but not permitted |
| 404 | `not_found` | Resource missing (or existence hidden) |
| 409 | `conflict` | Duplicate / state conflict |
| 429 | `rate_limited` | Rate limit exceeded |
| 500 | `internal_error` | Unexpected server failure |

---

## 4. Resource paths (Phase 1 client surface)

| Method | Path | Client method |
|--------|------|---------------|
| `GET` | `/api/v1/me` | `getMe` |
| `GET` | `/api/v1/workspaces` | `listWorkspaces` |
| `GET` | `/api/v1/workspaces/{workspaceId}` | `getWorkspace` |
| `GET` | `/api/v1/workspaces/{workspaceId}/projects` | `listProjects` |
| `GET` | `/api/v1/workspaces/{workspaceId}/projects/{projectId}` | `getProject` |
| `GET` | `/api/v1/health` | `health` |
| `GET` | `/api/v1/ready` | `ready` |

IDs are UUIDs. List endpoints return JSON arrays unless a future paginated envelope is versioned in.

---

## 5. Success responses

- `200` with JSON body for reads.
- `201` for creates (when introduced).
- `204` with empty body for deletes (when introduced).
- Timestamps are ISO-8601 with timezone offset (prefer `Z`).

---

## 6. Related packages

| Package | Role |
|---------|------|
| `@pvg/types` | Shared TS types + `ApiError` |
| `@pvg/schemas` | Zod contracts + `validate` helpers |
| `@pvg/api-client` | Typed `fetch` client for `/api/v1` |
| `@pvg/config` | `apiBaseUrl` + `apiVersionPrefix` |

See also [AUTHORIZATION-MODEL.md](../security/AUTHORIZATION-MODEL.md) and [SECURITY-ARCHITECTURE.md](../security/SECURITY-ARCHITECTURE.md).
