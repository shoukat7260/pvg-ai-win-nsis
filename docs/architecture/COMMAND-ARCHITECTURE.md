# Command Architecture

```
UI / AI plan → EditorCommand → HistoryStack.push → ProjectDocument
                              ↘ undo/redo via command.undo/execute
```

- Every meaningful edit is a command (`MoveClipsCommand`, `SetSpeedCommand`, …)
- Drag gestures: preview locally → single command on mouse-up
- Autosave listens to dirty flag after command commit (debounced)
- AI: `parseAiToolCall` → `planToCommands` → same commands (no bypass)
- Validation rejects NaN/Infinity/out-of-range before commit
