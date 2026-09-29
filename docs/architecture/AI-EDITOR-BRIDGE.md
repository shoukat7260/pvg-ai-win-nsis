# AI editor bridge

Path: `apps/desktop/src/services/aiEditorBridge.ts`

Flow:

1. User prompt → `tryLocalEditPlan` / future provider
2. Structured `AiPlan` validated in `@pvg/editor-core`
3. User confirms destructive steps
4. `planToCommands` → `editorStore.dispatch`
5. Same undo stack as manual edits

Forbidden: eval, shell, arbitrary Tauri invoke, credential access.

Context: `buildSafeAiEditorContext` — no paths, tokens, or vault secrets.
