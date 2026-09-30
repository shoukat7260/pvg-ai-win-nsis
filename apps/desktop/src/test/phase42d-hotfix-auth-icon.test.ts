import { describe, expect, it } from "vitest";
import {
  getDesktopApiBaseUrl,
  PVG_PRODUCTION_API_BASE_URL,
  resolveDesktopEnvironment,
} from "@/config/desktopApiConfig";
import { toSafeAuthError } from "@/auth/safeAuthError";
import { ApiClientError } from "@pvg/api-client";

describe("desktopApiConfig", () => {
  it("exposes a non-localhost production API default", () => {
    expect(PVG_PRODUCTION_API_BASE_URL).toMatch(/^https?:\/\//);
    expect(PVG_PRODUCTION_API_BASE_URL).not.toMatch(/localhost|127\.0\.0\.1/);
  });

  it("resolves an API base URL string", () => {
    const url = getDesktopApiBaseUrl();
    expect(url).toMatch(/^https?:\/\//);
    expect(url.endsWith("/")).toBe(false);
    // In vitest (non-PROD) this is typically loopback; production builds bake VITE_*.
    expect(typeof resolveDesktopEnvironment()).toBe("string");
  });
});

describe("toSafeAuthError", () => {
  it("maps invalid credentials", () => {
    const err = new ApiClientError(
      {
        code: "unauthorized",
        message: "Invalid email or password",
        request_id: "t",
      },
      401,
    );
    expect(toSafeAuthError(err)).toBe("Your email or password is incorrect.");
  });

  it("maps Failed to fetch to a network message", () => {
    expect(toSafeAuthError(new TypeError("Failed to fetch"))).toBe(
      "Unable to reach PVG AI. Check your internet connection.",
    );
  });

  it("maps 5xx to server unavailable", () => {
    const err = new ApiClientError(
      { code: "server_error", message: "boom", request_id: "t" },
      503,
    );
    expect(toSafeAuthError(err)).toBe("PVG AI server is temporarily unavailable.");
  });
});
