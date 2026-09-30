# PHASE 4.3 TEST MATRIX

Fill **Actual** / **Status** during Windows UAT. Do not mark PASS from browser-only runs for desktop-critical rows.

Legend: PASS | FAIL | BLOCKED | N/A | PENDING

## AUTH

| ID | Precondition | Action | Expected | Actual | Status |
|----|--------------|--------|----------|--------|--------|
| A1 | Fresh install | Sign up with valid fields | Account created; session; Home/onboarding | | PENDING |
| A2 | Existing account | Sign in correct password | AUTHENTICATED; Home | | PENDING |
| A3 | Existing account | Wrong password | "Email or password is incorrect." | | PENDING |
| A4 | API stopped | Sign in | "Unable to connect to PVG AI." | | PENDING |
| A5 | Signed in | Restart app | Session restored (no login) | | PENDING |
| A6 | Signed in | Logout → Sign in | Works | | PENDING |
| A7 | — | Continue in browser | Browser PKCE flow | | PENDING |

## HOME / SHELL

| ID | Precondition | Action | Expected | Actual | Status |
|----|--------------|--------|----------|--------|--------|
| H1 | Authenticated | Open Home | Create project CTA + recent | | PENDING |
| H2 | Authenticated | Nav Projects/Library/Templates/AI | Routes load, no blank | | PENDING |
| H3 | First run | Onboarding | Steps + skip + create | | PENDING |

## PROJECTS

| ID | Precondition | Action | Expected | Actual | Status |
|----|--------------|--------|----------|--------|--------|
| P1 | Workspace ready | Create 16:9 @ 30fps | Project created; editor opens | | PENDING |
| P2 | Project exists | Open from Home | Editor loads timeline | | PENDING |
| P3 | Invalid path | Open | Classified error + Retry/Home | | PENDING |
| P4 | After save | Close + reopen | Project loads | | PENDING |

## LIBRARY / MEDIA / TEMPLATES / AI

| ID | Precondition | Action | Expected | Actual | Status |
|----|--------------|--------|----------|--------|--------|
| L1 | — | Library Projects | Lists local projects | | PENDING |
| L2 | Project selected | Media import | Assets appear | | PENDING |
| T1 | — | Templates Use | Opens create flow | | PENDING |
| AI1 | — | AI workspace send | Reply + persist chat | | PENDING |
| AI2 | Editor open | Ask PVG AI | Contextual dock; not blocking inspector by default | | PENDING |

## EDITOR / TIMELINE / EXPORT

| ID | Precondition | Action | Expected | Actual | Status |
|----|--------------|--------|----------|--------|--------|
| E1 | Project open | Preview play/pause/seek | Works | | PENDING |
| E2 | Media on timeline | Trim/split/delete/undo | Works | | PENDING |
| E3 | Dirty project | Save pill | Unsaved → Saving… → Saved | | PENDING |
| X1 | Desktop | Export 1080p MP4 | File written; plays | | PENDING |

## WINDOWS / INSTALLER

| ID | Precondition | Action | Expected | Actual | Status |
|----|--------------|--------|----------|--------|--------|
| W1 | Artifact | Install NSIS | Icon, shortcut, Start Menu | | PENDING |
| W2 | Installed | Launch | Splash → auth/home | | PENDING |

## SECURITY

| ID | Precondition | Action | Expected | Actual | Status |
|----|--------------|--------|----------|--------|--------|
| S1 | Packaged | API target | Not localhost | | PENDING |
| S2 | — | Provider secrets | Never in project JSON | | PENDING |
