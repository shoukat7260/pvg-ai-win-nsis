# PVG AI — Authorization Model

## Roles

| Role | Intent |
|------|--------|
| OWNER | Full control including delete workspace |
| ADMIN | Manage members and projects |
| EDITOR | Edit projects/assets |
| CREATOR | Create projects/assets/generations |
| REVIEWER | Comment/review (foundation) |
| VIEWER | Read-only |

## Permission Matrix (foundation)

| Permission | OWNER | ADMIN | EDITOR | CREATOR | REVIEWER | VIEWER |
|------------|:-----:|:-----:|:------:|:-------:|:--------:|:------:|
| workspace.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| workspace.write | ✓ | ✓ | | | | |
| workspace.manage_members | ✓ | ✓ | | | | |
| project.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| project.write | ✓ | ✓ | ✓ | ✓ | | |
| project.delete | ✓ | ✓ | | | | |
| project.export | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| asset.read | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| asset.write | ✓ | ✓ | ✓ | ✓ | | |
| asset.delete | ✓ | ✓ | ✓ | | | |
| connection.read | ✓ | ✓ | ✓ | ✓ | | |
| connection.manage | ✓ | ✓ | | | | |

## Decision Flow

1. Resolve authenticated user from session/token (never from body).
2. Load membership for target workspace.
3. Map role → permissions.
4. Deny by default if permission missing.
5. Emit `AUTHORIZATION_DENIED` security event on deny.
6. Proceed to repository only after allow.

## IDOR Rules

Changing resource IDs in URL, query, headers, or JSON body must still resolve through membership of the **authenticated** user. Unauthorized → 404 or 403 (consistent policy: prefer 404 for non-leakage of existence when appropriate; Phase 1 uses 403/404 as documented per endpoint).
