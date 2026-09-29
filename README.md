# PVG AI — Product Generator AI

**Phase 1:** APPROVED  
**Phase 2:** APPROVED  
**Phase 3:** APPROVED  
**Phase 4:** READY FOR USER ACCEPTANCE (not approved until you sign off)

PVG AI is a local-first AI video creation and professional editing ecosystem.

| Phase | Focus |
|-------|--------|
| 1 | Security & architecture foundation |
| 2 | Auth, devices, vault, subscriptions |
| 3 | Local media engine, projects, import, proxy, preview foundation |
| 4 | Professional editor UI, timeline, canvas, keyframes, AI Copilot |

---

## What Phase 4 includes

- Schema **v3** sequences/tracks/clips (transform, keyframes, effects, transitions, text/shapes)
- Desktop **Edit** workspace (`/app/edit`) — professional NLE chrome
- Command/undo history (`@pvg/editor-core`)
- Timeline edit ops (move/trim/split/ripple/roll/link/group)
- Canvas program monitor + inspector
- AI Editor Copilot (allowlisted tools only)
- Command palette + keyboard shortcuts

## What Phase 4 does **not** include

AI video generation (Phase 5), voice/dubbing (Phase 6), advanced color/VFX (Phase 7), final export mastering.

See `docs/PHASE-4-IMPLEMENTATION.md` and `docs/PHASE-4-USER-ACCEPTANCE.md`.

---

## What Phase 3 includes

- Schema v2 `.pvg` projects (assets, bins, sequences foundation)
- Media import (LINK default / optional COPY)
- FFmpeg probe, thumbnails, waveforms, proxies (argv-safe)
- Local job center with cancel
- Source monitor preview
- Media browser (search/filter/sort)
- Missing media / relink architecture
- Autosave / recovery helpers
- Path-safe derivatives (never overwrite source)

## What Phase 3 does **not** include

Full timeline editor, AI generation, voice/dubbing, cloud media sync, marketplace.

---

## Quick start

```bash
./scripts/dev-up.sh
pnpm install
cp .env.example .env
./scripts/run-api.sh
pnpm --filter @pvg/desktop tauri:dev   # preferred for media
# or: pnpm --filter @pvg/desktop dev   # browser preview (mocked native media)
pnpm --filter @pvg/web dev
```

Install FFmpeg/ffprobe on PATH (or set `PVG_FFMPEG_PATH` / `PVG_FFPROBE_PATH`) for real probe/proxy/thumbnail generation.

---

## Tests

```bash
pnpm --filter @pvg/project-format test
pnpm --filter @pvg/desktop test
cd apps/desktop/src-tauri && cargo test -p pvg-core -p pvg-media -p pvg-vault

# Backend — run alone against Docker Postgres :5444
cd services/api && source .venv/bin/activate
export APP_ENV=test JWT_SECRET=test_jwt_secret_not_for_production_use_32
export JWT_ISSUER=pvg-ai JWT_AUDIENCE=pvg-api EMAIL_TRANSPORT=console
export PAYMENT_PROVIDER=sandbox PAYMENT_WEBHOOK_SECRET=test_webhook_secret_32chars_xx
export MFA_ENCRYPTION_KEY=UhC5MIGmK2lFWjv3qKbT0reAKcw1-S-IFg1DtAYQMRE=
export DATABASE_URL=postgresql+asyncpg://pvg_app:pvg_dev_change_me@localhost:5444/pvg
export DATABASE_ADMIN_URL=postgresql+asyncpg://pvg_migrator:pvg_migrator_dev_change_me@localhost:5444/pvg
export REDIS_URL=redis://localhost:6480/0 CSRF_SECRET=test_csrf_secret_not_for_production_32
pytest -q
```

Manual UAT: `docs/PHASE-3-USER-ACCEPTANCE.md`

---

## Ports

| Service  | Host port |
|----------|-----------|
| Postgres | **5444**  |
| Redis    | **6480**  |

---

## Security principles

1. Never trust client ownership IDs  
2. Authz + RLS  
3. Provider secrets only on device vault — never in project.json  
4. Narrow Tauri IPC; no shell; FFmpeg argv arrays only  
5. Derivatives never overwrite sources  
6. Local-first — no automatic media upload  

See `docs/PHASE-3-*.md` and `docs/architecture/MEDIA-*.md`.
