import { OPENCUT_PINNED_COMMIT } from "../baseline.js";

let wasmInitAttempted = false;
let wasmAvailable = false;

/** Lazy WASM probe — compositor preview path (incremental integration). */
export async function ensureOpenCutWasm(): Promise<boolean> {
  if (wasmInitAttempted) return wasmAvailable;
  wasmInitAttempted = true;
  try {
    await import("opencut-wasm");
    wasmAvailable = true;
  } catch {
    wasmAvailable = false;
  }
  return wasmAvailable;
}

export function getOpenCutWasmStatus(): {
  available: boolean;
  baselineCommit: string;
} {
  return { available: wasmAvailable, baselineCommit: OPENCUT_PINNED_COMMIT };
}
