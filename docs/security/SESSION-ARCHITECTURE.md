# Session Architecture

**Phase:** 2

Sessions (`sessions` table) bind a user (and optional device) to a refresh-token family:

| Field | Purpose |
|-------|---------|
| `family_id` | Rotation lineage; reuse → revoke all active members |
| `refresh_token_hash` | SHA-256 of opaque refresh (never raw) |
| `access_jti` | Latest access token id |
| `last_seen_at` | Activity touch on authenticated requests |
| `revoke_reason` | logout / rotated / refresh_reuse / password_reset / … |
| `created_from` | password / oauth_google / desktop_pkce / … |

RLS: `user_id = app.current_user_id`, with trusted `app.auth_lookup=1` only inside server-side hash lookups (refresh/email tokens).
