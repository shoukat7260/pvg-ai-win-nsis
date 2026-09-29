# Authentication Architecture

**Phase:** 2  
**Status:** Implemented (backend)

## Goals

- Passwords hashed with **Argon2id** (`argon2-cffi`): time_cost=3, memory_cost=65536 KiB, parallelism=4, hash_len=32, salt_len=16. Rehash-on-login when parameters drift.
- Short-lived **JWT access** tokens (claims: `sub`, `sid`, `iat`, `exp`, `iss`, `aud`, `jti`, `typ=access`).
- **Opaque refresh** tokens: random, stored only as SHA-256 hashes; rotation on every use; reuse of a rotated token invalidates the entire token **family**.
- Email verification and password-reset tokens: hashed, single-use, TTL.
- `X-Test-User-Id` is accepted **only** when `APP_ENV=test`.
- Client-supplied `user_id` / `owner_id` are never authoritative.

## Web cookies

Refresh cookie: `HttpOnly` + `Secure` (staging/production) + `SameSite=Lax`, path `/api/v1/auth`.  
CSRF: double-submit via `GET /api/v1/auth/csrf` (`pvg_csrf` cookie + `X-CSRF-Token` header) for cookie-mode clients.

## Endpoints

See `/api/v1/auth/*`, `/api/v1/mfa/*`, `/api/v1/oauth/google/*`, `/api/v1/auth/desktop/*`.
