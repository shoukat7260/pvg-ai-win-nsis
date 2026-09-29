import { describe, expect, it } from "vitest";
import {
  asUuid,
  isUuid,
  isApiError,
  isConnectivityMode,
  isWorkspaceRole,
  isProviderType,
  isConnectionStatus,
  isAuditEventType,
  isSecurityEventType,
  roleHasPermission,
  PERMISSIONS,
} from "./index.js";

describe("isUuid / asUuid", () => {
  it("accepts valid UUIDs", () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    expect(isUuid(id)).toBe(true);
    expect(asUuid(id)).toBe(id);
  });

  it("rejects non-UUIDs", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid(123)).toBe(false);
    expect(isUuid(null)).toBe(false);
    expect(() => asUuid("abc")).toThrow(TypeError);
  });
});

describe("isApiError", () => {
  it("guards structured errors", () => {
    expect(
      isApiError({
        code: "not_found",
        message: "Missing",
        request_id: "req-1",
      }),
    ).toBe(true);
    expect(isApiError({ code: "x", message: "y" })).toBe(false);
    expect(isApiError(null)).toBe(false);
  });
});

describe("enum type guards", () => {
  it("validates connectivity, roles, providers, events", () => {
    expect(isConnectivityMode("LOCAL_ONLY")).toBe(true);
    expect(isConnectivityMode("offline")).toBe(false);
    expect(isWorkspaceRole("OWNER")).toBe(true);
    expect(isWorkspaceRole("superuser")).toBe(false);
    expect(isProviderType("elevenlabs")).toBe(true);
    expect(isProviderType("openrouter")).toBe(true);
    expect(isProviderType("openai")).toBe(false);
    expect(isConnectionStatus("connected")).toBe(true);
    expect(isConnectionStatus("online")).toBe(false);
    expect(isAuditEventType("project.created")).toBe(true);
    expect(isAuditEventType("unknown")).toBe(false);
    expect(isSecurityEventType("AUTHORIZATION_DENIED")).toBe(true);
    expect(isSecurityEventType("HACK")).toBe(false);
  });
});

describe("permissions", () => {
  it("grants OWNER all core permissions", () => {
    expect(roleHasPermission("OWNER", PERMISSIONS.PROJECT_DELETE)).toBe(true);
    expect(roleHasPermission("VIEWER", PERMISSIONS.PROJECT_WRITE)).toBe(false);
    expect(roleHasPermission("CREATOR", PERMISSIONS.ASSET_WRITE)).toBe(true);
  });
});
