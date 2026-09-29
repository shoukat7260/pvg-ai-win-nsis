# Provider Credential Architecture (Phase 2)

## Hard rule

Raw provider API keys **never** go in PostgreSQL, Redis, localStorage, sessionStorage, Zustand persistence, logs, analytics, URLs, audit payloads, or diagnostics.

## Split

| Local vault (device) | Cloud metadata |
|----------------------|----------------|
| Encrypted/OS-protected secret | provider type, connection id, device id, label, status |
| last_used_at local | last_validated_at, usage/balance snapshots if synced |

## Device scope

Connecting ElevenLabs on Device A does **not** copy the key to Device B. User reconnects per device. UX must explain this (desktop Settings → Connections).

## IPC surface (narrow)

Implemented in `pvg-vault` + Tauri commands:

| Command | Secrets returned to React? |
|---------|----------------------------|
| `save_provider_credential` | No |
| `get_provider_credential` | Native-only (adapters); never bulk-dumped to UI |
| `delete_provider_credential` | No |
| `has_provider_credential` | Boolean only |
| `list_provider_metadata` | Metadata only (key id, label, timestamps) |
| `store_session_refresh` / `clear_session_refresh` | Refresh stored in vault; not shown in UI |
| `vault_status_cmd` / `vault_lock` | Status only |

**Forbidden:** `run_any_command`, `dump_all_secrets`, unrestricted filesystem, arbitrary shell.

## Backends

- Prefer OS keyring (`keyring` crate → Windows Credential Manager / Secret Service / Keychain).
- Fallback: `MemoryCredentialVault` when `PVG_VAULT_BACKEND=memory` or under unit tests.

## Connection methods

`API_KEY` | `OAUTH` | `TOKEN` | `SERVICE_ACCOUNT`

Adapters: `validateCredential`, `getAccountMetadata`, `getUsage`, `getBalance`, `getCapabilities` — return `NOT_SUPPORTED` rather than fabricated balances.

## Offline

Local secret may remain; cloud validation may be UNAVAILABLE — do not show “invalid” solely due to offline.

## UI cards

ElevenLabs, Google (`google_veo`), Runway, Kling, fal.ai, OpenRouter — Connect / Test / Disconnect / Refresh. After save, only a short `secretHint` (e.g. last 4 chars) may appear.
