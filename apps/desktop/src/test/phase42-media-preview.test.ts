import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  registerMediaBlob,
  getMediaBlobUrl,
  revokeMediaBlob,
  clearMediaBlobRegistry,
  mediaBlobRegistrySize,
} from "@/services/mediaBlobRegistry";
import { resolveMediaPreviewUrl } from "@/services/mediaPreview";

describe("Phase 4.2 media preview resolver", () => {
  beforeEach(() => {
    clearMediaBlobRegistry();
  });
  afterEach(() => {
    clearMediaBlobRegistry();
  });

  it("registers and revokes blob URLs without leaking", () => {
    const file = new File([new Uint8Array([0, 0, 0, 1])], "clip.mp4", {
      type: "video/mp4",
    });
    const url = registerMediaBlob("asset-1", file);
    expect(url.startsWith("blob:")).toBe(true);
    expect(getMediaBlobUrl("asset-1")).toBe(url);
    expect(mediaBlobRegistrySize()).toBe(1);
    revokeMediaBlob("asset-1");
    expect(getMediaBlobUrl("asset-1")).toBeNull();
    expect(mediaBlobRegistrySize()).toBe(0);
  });

  it("resolveMediaPreviewUrl prefers blob registry in browser", async () => {
    const file = new File([new Uint8Array([0, 0])], "demo.mp4", {
      type: "video/mp4",
    });
    registerMediaBlob("a-uuid", file);
    const res = await resolveMediaPreviewUrl({
      projectPath: "/tmp/PVG/users/local/projects/Demo.pvg",
      assetId: "a-uuid",
      asset: { kind: "video" } as never,
      previewSource: "auto",
    });
    expect(res.transport).toBe("blob");
    expect(res.url?.startsWith("blob:")).toBe(true);
    expect(res.kind).toBe("video");
  });

  it("returns helpful reason when no blob and browser has no disk path", async () => {
    const res = await resolveMediaPreviewUrl({
      projectPath: "/tmp/PVG/users/local/projects/Demo.pvg",
      assetId: "missing",
      asset: { kind: "video" } as never,
    });
    expect(res.url).toBeNull();
    expect(res.transport).toBe("none");
    expect(res.reason).toMatch(/blob|File-picker|browser/i);
  });
});
