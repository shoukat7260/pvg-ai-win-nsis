import { describe, expect, it } from "vitest";
import { buildRulerTicksMs, getRulerConfig } from "./ruler-utils.js";
import { pvgZoomToOpenCutLevel } from "./zoom-utils.js";

describe("OpenCut-adapted ruler", () => {
  it("produces frame labels when zoomed in", () => {
    const zoom = pvgZoomToOpenCutLevel(2);
    const config = getRulerConfig({ zoomLevel: zoom, fps: 30 });
    expect(config.labelIntervalSeconds).toBeLessThan(1);
    const ticks = buildRulerTicksMs({
      durationMs: 5000,
      zoomLevel: zoom,
      fps: 30,
    });
    expect(ticks.length).toBeGreaterThan(5);
    expect(ticks.some((t) => t.kind === "label")).toBe(true);
  });
});
