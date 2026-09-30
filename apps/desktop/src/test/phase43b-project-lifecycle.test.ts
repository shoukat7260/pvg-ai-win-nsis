import { beforeEach, describe, expect, it, vi } from "vitest";
import { projectService } from "@/services/projects";
import { nativeApi } from "@/services/tauri";

describe("Phase 4.3B project lifecycle", () => {
  beforeEach(() => {
    // browser preview maps are module state; create unique names per test
  });

  it("create → rename → duplicate → trash → restore → permanent delete", async () => {
    const created = await projectService.create("Lifecycle A", "ws-local", "test");
    expect(created.name).toBe("Lifecycle A");
    expect(created.path).toContain("Lifecycle-A.pvg");

    const renamed = await projectService.rename(created.path, "Lifecycle B");
    expect(renamed.name).toBe("Lifecycle B");
    expect(renamed.path).toContain("Lifecycle-B.pvg");

    const dup = await projectService.duplicate(renamed.path);
    expect(dup.name).toMatch(/Copy/);
    expect(dup.path).not.toBe(renamed.path);
    expect(dup.id).not.toBe(renamed.id);

    const list1 = await projectService.list();
    expect(list1.some((p) => p.path === renamed.path)).toBe(true);
    expect(list1.some((p) => p.path === dup.path)).toBe(true);

    const trashed = await projectService.trash(renamed.path);
    expect(trashed.trashed).toBe(true);
    const list2 = await projectService.list();
    expect(list2.some((p) => p.path === renamed.path)).toBe(false);

    const trashList = await projectService.listTrash();
    expect(trashList.some((p) => p.path === trashed.path)).toBe(true);

    const restored = await projectService.restore(trashed.path);
    expect(restored.trashed).toBe(false);
    expect((await projectService.list()).some((p) => p.path === restored.path)).toBe(true);

    const trashedAgain = await projectService.trash(restored.path);
    await projectService.deletePermanent(trashedAgain.path);
    expect((await projectService.listTrash()).some((p) => p.path === trashedAgain.path)).toBe(
      false,
    );
  });

  it("generateThumbnail persists thumbnailPath on metadata", async () => {
    const created = await projectService.create("Thumb Project", "ws-local");
    const withThumb = await projectService.generateThumbnail(created.path);
    expect(withThumb.thumbnailPath).toBeTruthy();
  });

  it("surfaces errors instead of silent failure", async () => {
    await expect(projectService.rename("/missing/nope.pvg", "X")).rejects.toThrow();
    await expect(projectService.trash("/missing/nope.pvg")).rejects.toThrow();
  });
});

describe("Phase 4.3B nativeApi surface", () => {
  it("exposes lifecycle commands", () => {
    expect(typeof nativeApi.renameProject).toBe("function");
    expect(typeof nativeApi.duplicateProject).toBe("function");
    expect(typeof nativeApi.trashProject).toBe("function");
    expect(typeof nativeApi.restoreProject).toBe("function");
    expect(typeof nativeApi.deleteProjectPermanent).toBe("function");
    expect(typeof nativeApi.listTrashedProjects).toBe("function");
    expect(typeof nativeApi.generateProjectThumbnail).toBe("function");
  });
});

// silence unused import in case tree-shaking
void vi;
