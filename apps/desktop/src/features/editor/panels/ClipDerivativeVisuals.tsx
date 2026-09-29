import { useEffect, useState } from "react";
import type { ProjectAsset } from "@pvg/project-format";
import {
  resolveClipDerivatives,
  type ClipDerivativeVisual,
} from "@/services/clipDerivatives";

/** Derivative-backed filmstrip / waveform for a timeline clip. */
export function ClipDerivativeVisuals(props: {
  kind: string;
  projectPath: string | null;
  asset: ProjectAsset | null | undefined;
}) {
  const [visual, setVisual] = useState<ClipDerivativeVisual>({
    thumbnailUrl: null,
    waveformUrl: null,
    hasProxy: false,
    missing: false,
  });

  useEffect(() => {
    let cancelled = false;
    void resolveClipDerivatives({
      projectPath: props.projectPath,
      asset: props.asset,
    }).then((v) => {
      if (!cancelled) setVisual(v);
    });
    return () => {
      cancelled = true;
    };
  }, [props.projectPath, props.asset]);

  if (props.kind === "audio") {
    return (
      <div
        className={`clip-waveform ${visual.waveformUrl ? "has-derivative" : "placeholder"}`}
        aria-hidden
        data-testid="clip-waveform"
        style={
          visual.waveformUrl
            ? {
                backgroundImage: `url(${visual.waveformUrl})`,
                backgroundSize: "cover",
                backgroundRepeat: "no-repeat",
              }
            : undefined
        }
      />
    );
  }

  if (props.kind === "video" || props.kind === "image") {
    return (
      <div
        className={`clip-filmstrip ${visual.thumbnailUrl ? "has-derivative" : "placeholder"} ${visual.missing ? "missing" : ""}`}
        aria-hidden
        data-testid="clip-filmstrip"
        style={
          visual.thumbnailUrl
            ? {
                backgroundImage: `url(${visual.thumbnailUrl})`,
                backgroundSize: "auto 100%",
                backgroundRepeat: "repeat-x",
              }
            : undefined
        }
      />
    );
  }

  return null;
}
