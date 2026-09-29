# Linux / Tauri system dependencies

Phase 1 desktop (`apps/desktop/src-tauri`) needs these packages for full `cargo check` / `tauri build` on Ubuntu 24.04:

```bash
sudo apt-get update
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  build-essential \
  curl wget file \
  libxdo-dev \
  libssl-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev \
  patchelf \
  pkg-config
```

Runtime libraries (`libwebkit2gtk-4.1-0`, `libgtk-3-0`) may already be present; **`-dev`** packages are required to compile the Tauri shell.

This environment currently lacks `libgtk-3-dev` / `libwebkit2gtk-4.1-dev` (sudo install blocked), so full `cargo check` on the Tauri package fails at `gdk-3.0` pkg-config.

## Tests without GTK

Path validation, project serialization, and IPC input validation live in `crates/pvg-core` (no Tauri/GTK dependency):

```bash
cd "/home/projects/PVG AI/apps/desktop/src-tauri"
CARGO_TARGET_DIR=/tmp/pvg-desktop-target cargo test -p pvg-core
```

Frontend verification does not need WebKit:

```bash
cd "/home/projects/PVG AI"
pnpm --filter @pvg/desktop test
pnpm --filter @pvg/desktop build
```

Full native check (after installing system deps):

```bash
cd "/home/projects/PVG AI/apps/desktop/src-tauri"
cargo check
cargo test
```
