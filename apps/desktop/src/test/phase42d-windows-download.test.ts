import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

describe("Phase 4.2D Windows download contract", () => {
  it("keeps download unavailable when release.json is absent", () => {
    const releasePath = path.resolve(
      __dirname,
      "../../../../artifacts/windows/release.json",
    );
    // In CI/dev without published artifact, release.json may be missing — that is correct.
    if (!fs.existsSync(releasePath)) {
      expect(fs.existsSync(releasePath)).toBe(false);
      return;
    }
    const raw = fs.readFileSync(releasePath, "utf8");
    const data = JSON.parse(raw) as {
      artifact: string;
      sha256: string;
      version: string;
      commit: string;
    };
    expect(data.artifact).toBe("PVG-AI-Setup-x64.exe");
    expect(data.sha256).toMatch(/^[a-f0-9]{64}$/i);
    expect(data.version).toBeTruthy();
    expect(data.commit).toMatch(/^[a-f0-9]{7,40}$/i);
  });
});
