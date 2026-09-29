import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// jsdom often lacks blob URL APIs used by media preview registry
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as typeof ResizeObserver;
}

if (typeof URL.createObjectURL !== "function") {
  const urls = new Map<string, Blob>();
  let seq = 0;
  URL.createObjectURL = ((blob: Blob) => {
    const id = `blob:pvg-test-${++seq}`;
    urls.set(id, blob);
    return id;
  }) as typeof URL.createObjectURL;
  URL.revokeObjectURL = ((id: string) => {
    urls.delete(id);
  }) as typeof URL.revokeObjectURL;
}

afterEach(() => {
  cleanup();
  localStorage.clear();
});
