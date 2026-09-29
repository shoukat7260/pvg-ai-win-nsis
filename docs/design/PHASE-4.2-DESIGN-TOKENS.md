# PHASE 4.2 — Design Tokens

See also `apps/desktop/src/styles/editor-tokens.css` and `pvg-inputs.css`.

## Surfaces

| Token | Role |
|-------|------|
| `--pvg-bg-root` | Darkest chrome |
| `--pvg-bg-workspace` | Center workspace |
| `--pvg-surface-1/2/3` | Panel / raised / control |

## Text

`--pvg-text-primary` · `--pvg-text-secondary` · `--pvg-text-muted` · `--pvg-text-disabled`

## Input contract (CRITICAL)

### Dark (editor / AI)

| Token | Purpose |
|-------|---------|
| `--pvg-input-bg` | Field fill |
| `--pvg-input-text` | Typed text (never inherit AppShell) |
| `--pvg-input-placeholder` | Placeholder |
| `--pvg-input-border` / `-hover` / `-focus` | Borders |
| `--pvg-input-ring` | Focus ring |

### Light (Settings / Auth on light shell)

`--pvg-input-light-*` equivalents — use `.pvg-input--light` / `PvgInput surface="light"`.

## Classes

- `.pvg-input` / `.pvg-textarea` / `.pvg-select`
- Variants: `--light`, `--compact`, `--error`, `--success`

## Accent

Use for active/selected/focus/primary only — not wallpaper.
