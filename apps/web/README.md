# PVG AI Web (Phase 2)

Companion web for account, auth, devices/sessions, connections metadata, and billing display.

## Run

```bash
pnpm install
pnpm --filter @pvg/web dev          # http://localhost:5173
pnpm --filter @pvg/web test
pnpm --filter @pvg/web build
```

Env (optional):

| Variable | Purpose |
|----------|---------|
| `VITE_API_PUBLIC_URL` | API origin (default `http://localhost:8000`) |
| `VITE_AUTH_COOKIE_MODE` | `true` to send cookies + call `/auth/refresh` on bootstrap |

## SPA auth pattern

- **Access token**: memory only (`Authorization: Bearer`), never `localStorage` / Zustand persist.
- **Refresh**: prefer HttpOnly Secure SameSite cookie from the API when `VITE_AUTH_COOKIE_MODE=true`.
- Without cookie mode, a full page reload clears the access token and returns to login (acceptable until cookie refresh is wired by the backend).

See `docs/security/AUTHENTICATION-ARCHITECTURE.md` and `docs/security/SESSION-ARCHITECTURE.md`.
