# PHASE 4.1 — Current UI Audit (from user screenshots)

**Date:** 2026-09-29  
**Evidence:** User-uploaded screenshots of `/app/edit`, Settings, About  
**Status:** Audit complete — implementation delivered; USER ACCEPTANCE PENDING

## Summary

Phase 4 is **functionally usable** but visually reads as a **functional web prototype**, not a professional NLE workstation. Settings remains a light SaaS dashboard while the editor is dark — product inconsistency. Critical: **AI Copilot is buried/clipped** under the inspector.

---

## Problem catalog

### P1 — AI Copilot buried / clipped
**CURRENT:** Right column stacks Inspector above Copilot; Copilot becomes a thin strip; input can feel secondary.  
**WHY:** Flex column without dedicated split/max modes; inspector content wins vertical space.  
**SOLUTION:** First-class right dock with Inspector | AI | Split modes + draggable vertical divider; AI input pinned.  
**VALIDATION:** P4.1-E/F/G; screenshots show Send always visible.

### P2 — Cryptic left rail (M / P / T)
**CURRENT:** Single-letter buttons.  
**WHY:** Not scannable; unprofessional; no real icon system.  
**SOLUTION:** SVG icon rail + tooltips + optional labels; clear active state.  
**VALIDATION:** Hover tooltips; keyboard/label accessible.

### P3 — Viewer not dominant
**CURRENT:** Black preview feels small; transport mixed with timeline chrome.  
**WHY:** Weak surface hierarchy; no dedicated transport bar.  
**SOLUTION:** Expand viewer; separate Program header + Transport bar; Fit/zoom menu.  
**VALIDATION:** Visual at 1920×1080.

### P4 — Timeline looks primitive
**CURRENT:** Flat clip blocks; weak track headers; large empty lanes.  
**WHY:** Minimal chrome; letter toggles (V/L/M/S).  
**SOLUTION:** Compact track headers with icons; type-tinted clips; clearer playhead/ruler.  
**VALIDATION:** Visual + functional trim/move regression.

### P5 — Inspector dead space / weak hierarchy
**CURRENT:** “Select a clip…” empty state; flat sections; large gaps.  
**WHY:** No accordion / progressive disclosure / rich no-selection state.  
**SOLUTION:** Sequence summary when idle; accordion groups when selected; Mixed multi-select.  
**VALIDATION:** Select video/text/none.

### P6 — Media drop zone dominates
**CURRENT:** Huge dashed import area even with assets.  
**WHY:** Always-on empty-state import UI.  
**SOLUTION:** Compact import toolbar when assets exist; full drop zone only when empty.  
**VALIDATION:** Import with 0 assets vs ≥1 asset.

### P7 — Text/Shapes/Transitions/Effects are bare lists
**CURRENT:** Full-width giant buttons or text lists.  
**WHY:** No library card pattern.  
**SOLUTION:** Compact creation grids / category lists with search.  
**VALIDATION:** Visual density check.

### P8 — History as SaaS cards
**CURRENT:** Large rounded rows, lots of empty space.  
**WHY:** Card pattern instead of dense list.  
**SOLUTION:** Dense icon + label + relative action rows.  
**VALIDATION:** Visual.

### P9 — Weak workspace mode switcher
**CURRENT:** Tiny outline pills; disabled modes look broken.  
**WHY:** Flat styling; no “coming later” treatment.  
**SOLUTION:** Segmented control; foundation modes clearly disabled with tooltip.  
**VALIDATION:** Hover audio/color.

### P10 — Save competes with entire chrome
**CURRENT:** Large solid Save vs sparse hierarchy.  
**WHY:** Button weight imbalance.  
**SOLUTION:** Compact actions; Save primary but not oversized; status in breadcrumb.  
**VALIDATION:** Visual hierarchy review.

### P11 — Settings light-theme SaaS cards
**CURRENT:** Giant white cards, black pill inputs, low-contrast labels.  
**WHY:** Separate design language from editor.  
**SOLUTION (4.1 scope):** Shared tokens where cheap; **do not** rebuild all Settings — editor priority. Soften contrast bugs only if time.  
**VALIDATION:** Editor cohesion first.

### P12 — Low contrast metadata
**CURRENT:** Dim greys on dark/light surfaces (About values, Preferences labels).  
**WHY:** Muted tokens too low.  
**SOLUTION:** Raise `--pvg-text-secondary` / `--pvg-text-muted` floors.  
**VALIDATION:** Contrast audit.

### P13 — No layout persistence / reset
**CURRENT:** Panel sizes session-only, no Reset Workspace.  
**SOLUTION:** Persist panel sizes/modes; Reset Workspace action.  
**VALIDATION:** Reload preserves widths.

### P14 — Surfaces feel flat / same black
**CURRENT:** Weak panel separation.  
**SOLUTION:** Surface 1/2/3 token ladder + subtle borders.  
**VALIDATION:** Visual.

---

## Non-goals (preserve Phase 4)
Timeline engine, commands, AI tool allowlist, media/project systems, auth.
