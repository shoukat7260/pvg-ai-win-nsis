# PVG ↔ OpenCut feature matrix (Phase 4.2)

| Feature | PVG current | OpenCut | Decision | Reason | Migration risk | Final owner |
|---------|-------------|---------|----------|--------|----------------|-------------|
| Authentication | PVG Phase 2 | better-auth cloud | **PVG OWNED** | Single user system | Low | PVG |
| Project container | `@pvg/project-format` | OpenCut project DB | **PVG OWNED** | Local-first bundle | Medium | PVG |
| Media identity | `asset_id` UUID | media manager ids | **ADAPT OPENCUT** via adapter map | No path identity | Medium | PVG + adapter |
| Media preview URL | `resolveMediaPreviewUrl` | media + renderer | **PVG WRAPPER** | Tauri scoped assets | Low | PVG |
| Timeline state | `@pvg/editor-core` + Zustand | EditorCore timeline | **ADAPT OPENCUT** UI/logic incrementally | One canonical persisted model (PVG sequences) | High | PVG persistence, OpenCut UX |
| Timeline UI | Custom → OpenCut panel | Full React timeline | **REUSE OPENCUT** (ported zoom/ruler; full UI incremental) | Professional NLE density | Medium | `@pvg/opencut-integration` + desktop |
| Playback clock | `editorStore.playback` | PlaybackManager | **PVG OWNED** (sync to viewer) | Single clock | Medium | PVG |
| Selection | `editorStore.selection` | SelectionManager | **PVG OWNED** | AI + inspector | Medium | PVG |
| Undo/history | `HistoryStack` + commands | CommandManager | **PVG OWNED** | AI undo parity | Medium | PVG |
| Preview/compositor | `<video>` + canvas | WASM compositor | **ADAPT OPENCUT** WASM next | Real video now; GPU comp later | High | Hybrid |
| Inspector | PVG Inspector | Properties panels | **PVG WRAPPER** | Brand + AI context | Low | PVG |
| AI Copilot | PVG panel | N/A | **PVG OWNED** | Security boundary | Low | PVG |
| Workspace shell | Phase 4.1 layout | OpenCut web chrome | **PVG OWNED** | Product identity | Low | PVG |
| Browser editor | `/app/edit` dev | Next app | **DEFER** web prod | Desktop-first | Low | Tauri only prod |
| FFmpeg/proxy | Phase 3 Tauri | mediabunny/wasm | **PVG OWNED** | Existing pipeline | Low | PVG |
| Export | Not in 4.2 | Export flows | **DEFER** | Phase 5+ | — | PVG |
