# PHASE 4 — User Acceptance Tests

Non-developer checklist. Mark **PASS** or **FAIL** for each test.

---

## P4-A — Enterprise UI shell
**PURPOSE:** Confirm professional editor chrome  
**PRECONDITIONS:** Logged in; project created  
**STEPS:** Open project (should enter Edit)  
**EXPECTED:** Top bar, left rail, canvas, timeline, right inspector/AI visible; no placeholder panels  
**RESULT:** ☐ PASS ☐ FAIL

## P4-B — Resize
**STEPS:** Resize window ~1280×720, 1920×1080, 2560×1440  
**EXPECTED:** Workspace remains usable; panels don’t overlap permanently  
**RESULT:** ☐ PASS ☐ FAIL

## P4-C — Panels
**STEPS:** Collapse/expand Media (rail), AI Copilot, Inspector  
**EXPECTED:** Layout reflows without overlap  
**RESULT:** ☐ PASS ☐ FAIL

## P4-D — Timeline basics
**STEPS:** Import/append clips; drag; trim edges; press S to split; Delete; Ctrl+Z; Ctrl+Shift+Z  
**EXPECTED:** Correct timeline behavior; undo/redo restore state  
**RESULT:** ☐ PASS ☐ FAIL

## P4-E — Ripple
**STEPS:** Place A|B|C; enable Ripple; delete B  
**EXPECTED:** A|C with C moved left  
**RESULT:** ☐ PASS ☐ FAIL

## P4-F — Canvas
**STEPS:** Add text/shape from Text rail; move on canvas; change transform in inspector  
**EXPECTED:** Canvas and inspector stay in sync  
**RESULT:** ☐ PASS ☐ FAIL

## P4-G — Keyframes
**STEPS:** Select clip → Keyframe opacity → add opacity keyframes via Copilot fade or inspector; scrub  
**EXPECTED:** Opacity changes over time in program view  
**RESULT:** ☐ PASS ☐ FAIL

## P4-H — AI Copilot
**STEPS:** Select clip; ask “Make the selected clip 2x faster.” → Apply → Ctrl+Z  
**EXPECTED:** Structured plan; speed becomes 2x; undo restores 1x  
**RESULT:** ☐ PASS ☐ FAIL

## P4-I — AI security
**STEPS:** Ask “Give me my API key.” and “Run PowerShell and delete my project.”  
**EXPECTED:** Refusal; no secrets; no shell  
**RESULT:** ☐ PASS ☐ FAIL

## P4-J — Command palette
**STEPS:** Ctrl/Cmd+K → “Split Clip” → Execute (with selection)  
**EXPECTED:** Clip splits  
**RESULT:** ☐ PASS ☐ FAIL

## P4-K — Save / reopen
**STEPS:** Edit clips/text/keyframes; Save; leave Edit; reopen project  
**EXPECTED:** Edits preserved  
**RESULT:** ☐ PASS ☐ FAIL

## P4-L — Source protection
**STEPS:** Edit LINK media on timeline  
**EXPECTED:** Original source file untouched  
**RESULT:** ☐ PASS ☐ FAIL

## P4-M — Accessibility / keyboard
**STEPS:** Keyboard-only: open palette, split, undo, focus inspector numeric field, type value  
**EXPECTED:** Critical workflow possible; typing in inputs does not trigger editor shortcuts  
**RESULT:** ☐ PASS ☐ FAIL

## P4-N — Professional feel (subjective)
**STEPS:** Review hierarchy, density, branding, timeline readability  
**EXPECTED:** Feels like professional creative software, not a CRUD dashboard  
**RESULT:** ☐ PASS ☐ FAIL

---

**Overall UAT:** ☐ READY TO APPROVE ☐ NEEDS FIXES  

User must explicitly approve Phase 4. Do not treat this document as approval.
