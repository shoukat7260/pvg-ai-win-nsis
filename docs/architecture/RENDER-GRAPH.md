# Render Graph

```
Media Asset → Timeline Clip → Sequence → composeAtTime → Preview
                                         ↘ (future) Full Render → Encoder → Export
```

Preview must not flatten to an intermediate video per playhead move.
Export pipeline is intentionally separate (Phase 5+).

Nodes conceptually: Video layers → Graphics/Text → Effects → Transforms → Composite → Audio mix foundation.
