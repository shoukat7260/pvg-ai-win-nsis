# PHASE 4.1 — Design System

**Status:** READY for editor workstation use  
**Tokens file:** `apps/desktop/src/styles/editor-tokens.css`  
**Chrome CSS:** `apps/desktop/src/features/editor/editor.css`

## Principles

- Premium dark creative workstation (not SaaS dashboard)
- Accent teal used intentionally (active/selected/primary) — never wallpaper
- Dense but readable; compact controls; restrained radii (3–8px)
- Surface depth via layered neutrals + subtle borders (not blur)

## Color tokens

| Token | Role |
|-------|------|
| `--pvg-bg-root` | App chrome root |
| `--pvg-bg-workspace` | Center workspace |
| `--pvg-surface-1/2/3` | Panel / raised / control |
| `--pvg-border-subtle/default/strong` | Boundaries |
| `--pvg-text-primary/secondary/muted` | Hierarchy (muted still readable) |
| `--pvg-accent` / `-hover` / `-soft` | Signature teal |
| `--pvg-success/warning/danger/info` | Semantic |
| `--pvg-track-video/audio/text/overlay` | Timeline type tints |
| `--pvg-playhead` | Playhead |

## Typography

- Sans: IBM Plex Sans stack  
- Mono: IBM Plex Mono (timecode)  
- Scale: display → panel heading → body → label → value → timeline → meta  
- Avoid oversized headings; metadata must remain readable

## Spacing / radius / motion

- Space: 4 / 8 / 12 / 16 / 24  
- Radius: sm 3 · md 5 · lg 8 (no giant pills in editor)  
- Motion: `--pvg-dur-fast` / `--pvg-dur` + ease; respects `prefers-reduced-motion`

## Z-index layers

`base → panel → sticky → dropdown → tooltip → modal → palette`

## Icons

`apps/desktop/src/features/editor/icons/EditorIcons.tsx` — single stroke style, 16×16. Icon-only controls require `title` + `aria-label`.

## Component patterns (editor)

| Pattern | Class / component |
|---------|-------------------|
| Root shell | `.ed-root` |
| Top bar | `.ed-topbar` + `EditorTopBar` |
| Tool rail | `.ed-rail` + `EditorRail` |
| Right dock | `RightDock` (Inspector \| Split \| AI) |
| Panels | `.ed-panel` / `.ed-panel-h` / `.ed-panel-b` |
| Buttons | `.ed-btn` primary / ghost; `.ed-icon-btn`; `.ed-chip-btn` |
| Property rows | `.ed-row` + `NumField` |
| AI Copilot | `.ed-ai` + pinned `.ed-ai-input` |
| Command palette | `.cmd-palette` |
| Timeline | `.timeline-*` / `.tl-clip` |
| Canvas | `.canvas-*` |

## Variants

- Buttons: primary, secondary/ghost, danger, icon  
- Tabs: default / active / disabled (coming-later tooltip)  
- Panels: default, inspector, timeline, floating (palette)

## Out of scope (deferred)

Full Settings light-theme rebuild; Storybook package; global light theme.
