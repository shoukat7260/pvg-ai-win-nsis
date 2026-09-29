# PVG AI — Threat Model (Phase 1)

For each threat: **THREAT · IMPACT · ATTACK SURFACE · MITIGATION · TEST · STATUS**

---

### T01 — Credential theft
- **IMPACT:** Provider account abuse, billing fraud
- **ATTACK SURFACE:** localStorage, logs, DB, IPC leaks
- **MITIGATION:** CredentialVault; no secrets in React/DB/logs; redaction
- **TEST:** secret-leak suite (`TEST_SECRET_123`)
- **STATUS:** Phase 1 controls implemented (OS vault deferred)

### T02 — Session theft
- **IMPACT:** Account takeover
- **ATTACK SURFACE:** tokens in storage/transit/logs
- **MITIGATION:** secure cookie/header patterns (Phase 2); never log tokens; redaction
- **TEST:** redaction + session table foundation
- **STATUS:** Foundation; full auth Phase 2

### T03 — Token replay
- **IMPACT:** Unauthorized API use
- **ATTACK SURFACE:** stolen bearer tokens
- **MITIGATION:** short-lived tokens, rotation, device binding (Phase 2)
- **TEST:** interface + security event `INVALID_TOKEN`
- **STATUS:** Deferred implementation; events ready

### T04 — Authorization bypass
- **IMPACT:** Cross-tenant data access
- **ATTACK SURFACE:** missing checks in handlers
- **MITIGATION:** centralized authz service; no handler-only checks
- **TEST:** tenant isolation suite
- **STATUS:** Implemented

### T05 — IDOR
- **IMPACT:** Read/modify another user's resources by ID
- **ATTACK SURFACE:** URL/body/query IDs
- **MITIGATION:** ownership checks ignore client owner claims; RLS
- **TEST:** dedicated IDOR suite (12 cases)
- **STATUS:** Implemented

### T06 — Horizontal privilege escalation
- **IMPACT:** Access peer tenant data
- **ATTACK SURFACE:** workspace/project IDs
- **MITIGATION:** membership checks + RLS
- **TEST:** Tenant A/B matrix
- **STATUS:** Implemented

### T07 — Vertical privilege escalation
- **IMPACT:** Viewer performs admin actions
- **ATTACK SURFACE:** role confusion
- **MITIGATION:** permission maps by role; deny-by-default
- **TEST:** role permission unit tests
- **STATUS:** Foundation implemented

### T08 — Malicious input
- **IMPACT:** Injection, crash, corruption
- **ATTACK SURFACE:** API + IPC inputs
- **MITIGATION:** Pydantic/Zod/Rust typed validation
- **TEST:** validation unit tests
- **STATUS:** Implemented

### T09 — Path traversal
- **IMPACT:** Read/write outside allowed roots
- **ATTACK SURFACE:** IPC path args
- **MITIGATION:** canonicalize + root containment
- **TEST:** filesystem security suite
- **STATUS:** Implemented

### T10 — Malicious media files
- **IMPACT:** Parser exploits (future)
- **ATTACK SURFACE:** imported media
- **MITIGATION:** deferred; validate extensions/paths in Phase 1 only
- **TEST:** path/extension rejection
- **STATUS:** Partial (full media sandbox later)

### T11 — Arbitrary filesystem access
- **IMPACT:** Data exfiltration
- **ATTACK SURFACE:** broad Tauri FS permissions
- **MITIGATION:** narrow capabilities; no FS plugin blanket grants
- **TEST:** capability config review + path tests
- **STATUS:** Implemented

### T12 — Compromised frontend/webview
- **IMPACT:** Malicious invoke attempts
- **ATTACK SURFACE:** XSS / compromised UI
- **MITIGATION:** backend/native re-validation; CSP; no privileged shell
- **TEST:** IPC rejection tests
- **STATUS:** Foundation implemented

### T13 — Malicious future plugin
- **IMPACT:** Escape sandbox
- **ATTACK SURFACE:** plugin API
- **MITIGATION:** documented future plugin boundary; no plugin host in Phase 1
- **TEST:** N/A Phase 1
- **STATUS:** Documented only

### T14 — API abuse / rate abuse
- **IMPACT:** DoS, credential stuffing
- **ATTACK SURFACE:** public endpoints
- **MITIGATION:** rate-limit abstraction on sensitive routes
- **TEST:** rate limit unit/integration
- **STATUS:** Foundation implemented

### T15 — Database leakage
- **IMPACT:** Cross-tenant reads
- **ATTACK SURFACE:** SQL without tenant filter; privileged roles
- **MITIGATION:** RLS + app role; no superuser app connections
- **TEST:** RLS isolation tests
- **STATUS:** Implemented

### T16 — Log leakage
- **IMPACT:** Secret exposure
- **ATTACK SURFACE:** structured logs, diagnostics
- **MITIGATION:** redaction utility; diagnostics allowlist
- **TEST:** secret-leak tests
- **STATUS:** Implemented

### T17 — Accidental secret exposure
- **IMPACT:** Keys in repos/config
- **ATTACK SURFACE:** `.env`, compose, examples
- **MITIGATION:** `.env.example` without secrets; prod fail-closed
- **TEST:** config validation tests
- **STATUS:** Implemented

---

## Failure Policy

If any of T04–T06, T09, T11, T15–T16 fail in testing: **PHASE 1 = FAILED** until fixed.
