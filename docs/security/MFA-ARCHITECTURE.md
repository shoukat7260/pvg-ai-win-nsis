# MFA Architecture

**Phase:** 2

- TOTP secrets encrypted at rest with Fernet (`MFA_ENCRYPTION_KEY`).
- Recovery codes stored as Argon2id hashes; single-use.
- Login with MFA returns generic password success path as `{ mfa_required, challenge_id }` without tokens.
- Challenge verification: `POST /api/v1/auth/mfa/challenge/verify` with TOTP or recovery code.
