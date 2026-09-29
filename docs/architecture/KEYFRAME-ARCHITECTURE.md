# Keyframe Architecture

Generalized model: `clip.keyframes[propertyPath] = Keyframe[]`

Properties (Phase 4): `transform.x|y|scaleX|scaleY|rotation|opacity`  
Interpolation: hold | linear | easeIn | easeOut | bezier (handles)

Evaluation: `evaluateKeyframes` / `evaluateTransformProperty` / `composeAtTime`  
Presets: fade/slide/zoom/pop/simpleMove insert real keyframes.

Graph editor: evaluation is real; full handle UI is foundation (inspector + timeline markers).
