# OAuth / Desktop Browser Auth Flow (Phase 2)

## Principle

Desktop never embeds Google password UI. User authenticates in the **system browser**. Tokens and codes are never displayed in the desktop UI.

## Flow

1. Desktop generates PKCE `code_verifier` + S256 `code_challenge` (in-memory).
2. Desktop → `POST /api/v1/auth/desktop/start` with challenge (+ optional device name) → `{ authorizeUrl, state }`.
3. Desktop opens the authorize URL via **tauri-plugin-opener** (`opener:allow-open-url` only — no shell).
4. User completes login / Google OAuth / MFA on the web.
5. Server binds a one-time desktop auth code to `state` + PKCE.
6. Desktop polls `POST /api/v1/auth/desktop/poll` with `{ state, codeVerifier }` until `completed` | `expired` | `denied`.
   - Alternate adapter: `POST /api/v1/auth/desktop/complete` if the backend uses exchange-once semantics.
7. On success: access token kept **in memory**; refresh token stored via `store_session_refresh` in the OS vault.
8. Deep-link callback (optional future): same PKCE validation; never show the code in UI.

## Waiting / failure UX

- “Waiting for secure sign-in…” while polling.
- Failure screen with retry / back to login — no sensitive payload.

## Validations (mandatory)

state (one-time), PKCE verifier, code TTL, expected client, issuer/audience for IdP tokens, reject replay.

## Google account linking

Do not auto-link on unverified email alone. Require verified email + documented re-auth policy before linking `oauth_identities`.

## Forbidden

Client secrets in Tauri frontend; accepting callbacks without state/PKCE; showing codes/tokens in UI; storing refresh in localStorage / Zustand persist.

## Related

- `docs/security/AUTHENTICATION-ARCHITECTURE.md`
- `docs/security/SESSION-ARCHITECTURE.md`
- `docs/security/PROVIDER-CREDENTIAL-ARCHITECTURE.md`
