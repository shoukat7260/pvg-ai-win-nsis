import { describe, expect, it } from "vitest";
import { FOCUS_RING_CLASS, UI_CLASS_PREFIX } from "./index.js";

describe("@pvg/ui tokens export surface", () => {
  it("exposes focus ring class and prefix", () => {
    expect(FOCUS_RING_CLASS).toBe("pvg-focus-ring");
    expect(UI_CLASS_PREFIX).toBe("pvg");
  });
});
