import { describe, expect, it } from "vitest";
import { toSafeAuthError, toSafeSignupError } from "@/auth/safeAuthError";
import { ApiClientError } from "@pvg/api-client";
import { classifyProjectLoadError } from "@/features/editor/projectLoadDiagnostics";

describe("phase43 auth + project load diagnostics", () => {
  it("maps 401 to incorrect credentials", () => {
    const err = new ApiClientError(
      { code: "unauthorized", message: "Invalid email or password", request_id: "r1" },
      401,
    );
    expect(toSafeAuthError(err)).toBe("Email or password is incorrect.");
  });

  it("maps Tauri string vault errors without looking like bad credentials", () => {
    expect(toSafeAuthError("vault error: secret service unavailable")).toMatch(/session storage/i);
  });

  it("maps bare network TypeError", () => {
    expect(toSafeAuthError(new TypeError("Failed to fetch"))).toBe(
      "Unable to connect to PVG AI.",
    );
  });

  it("maps signup conflict", () => {
    const err = new ApiClientError(
      { code: "conflict", message: "An account with this email already exists", request_id: "r2" },
      409,
    );
    expect(toSafeSignupError(err)).toMatch(/already exists/i);
  });

  it("classifies missing project path", () => {
    const f = classifyProjectLoadError(new Error("No such file or directory"));
    expect(f.code).toBe("missing");
    expect(f.stage).toBe("resolve_path");
    expect(f.userMessage).not.toMatch(/unknown/i);
  });

  it("classifies corrupt JSON", () => {
    const f = classifyProjectLoadError(new Error("Unexpected token in JSON"));
    expect(f.code).toBe("corrupted");
  });
});
