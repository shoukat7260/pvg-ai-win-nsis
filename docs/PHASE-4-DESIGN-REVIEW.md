# PHASE 4 — Design Review

## Visual hierarchy
- Application chrome (top bar) → canvas as dominant workspace → dense timeline → precise inspector → collapsible Copilot
- Brand signal “PVG AI” in top bar without cloning competitor layouts

## Density
- Timeline track headers + clips designed for professional density
- Inspector uses progressive disclosure (Advanced toggle)

## Consistency
- Shared editor tokens in `editor.css` (surfaces, accents, clip type colors)
- Icon rail is monogram-based (coherent set; not mixed emoji packs)

## Issues to watch in UAT
1. At 1280×720, menubar hides — confirm Edit remains reachable via rail/palette
2. Media browser nested styles still use Phase 3 light-panel classes inside dark editor — acceptable for Phase 4; polish candidate
3. Export button disabled with “later phase” title — intentional, not fake

## Branding
- Charcoal/teal professional studio identity
- Avoids purple SaaS gradients and cream/serif marketing tropes in the editor
