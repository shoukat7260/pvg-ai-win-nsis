# Workspace Layout Architecture — Phase 4.1

## Default preset: PVG Editor

| Region | Default | Min | Max | Notes |
|--------|---------|-----|-----|-------|
| Left rail | 44px (112 expanded) | — | — | Icon / icon+label |
| Left browser | 260px | 200 | 400 | Media, libraries |
| Center viewer | flex | ~180px height | — | Dominant visual |
| Timeline | 240px height | 140 | 520 | Draggable top edge |
| Right dock | 340px | 260 | 460 | Inspector + AI |

Default `rightDockMode`: **split** (~48% inspector / remainder AI).

## Presets

- **editor** — left open, right split, balanced timeline  
- **media** — left media focused, right collapsed, shorter timeline  
- **ai** — left collapsed, right AI-maximized (≥360px)

## Persistence

`localStorage["pvg-editor-layout-v41"]` stores panel metrics. Mode/preset restored via store actions. Transient selection is not persisted.

## Reset

Top bar **Reset layout** + command palette **Reset Workspace Layout** → confirm → `resetWorkspaceLayout()`.

## Responsive strategy (desktop windows)

At narrow widths prefer: collapse AI → collapse secondary left → compact rail. Never hide timeline or viewer by default. Browser UAT at 1280–1920 supported via flex + clamps (not fixed screenshot size).

## Ultrawide

Extra width expands center first; side panels capped by max widths so viewer is not squeezed by runaway docks.
