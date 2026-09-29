import { describe, expect, it } from "vitest";
import {
  UserSchema,
  WorkspaceSchema,
  ProjectSchema,
  ApiErrorSchema,
  validate,
  parseOrThrow,
  ValidationError,
} from "./index.js";

const ts = "2026-09-29T06:00:00.000Z";

describe("UserSchema", () => {
  const valid = {
    id: "550e8400-e29b-41d4-a716-446655440000",
    email: "a@example.com",
    displayName: "Ada",
    status: "active",
    createdAt: ts,
    updatedAt: ts,
  };

  it("accepts valid user", () => {
    const r = validate(UserSchema, valid);
    expect(r.success).toBe(true);
  });

  it("rejects invalid email and id", () => {
    expect(validate(UserSchema, { ...valid, email: "nope" }).success).toBe(
      false,
    );
    expect(validate(UserSchema, { ...valid, id: "bad" }).success).toBe(false);
  });
});

describe("WorkspaceSchema / ProjectSchema", () => {
  it("validates workspace slug", () => {
    const ws = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      name: "Main",
      slug: "main-ws",
      ownerId: "550e8400-e29b-41d4-a716-446655440000",
      createdAt: ts,
      updatedAt: ts,
    };
    expect(validate(WorkspaceSchema, ws).success).toBe(true);
    expect(
      validate(WorkspaceSchema, { ...ws, slug: "Bad Slug" }).success,
    ).toBe(false);
  });

  it("validates project and throws on parseOrThrow", () => {
    const project = {
      id: "550e8400-e29b-41d4-a716-446655440002",
      workspaceId: "550e8400-e29b-41d4-a716-446655440001",
      name: "Promo",
      description: null,
      status: "draft",
      schemaVersion: 1,
      createdAt: ts,
      updatedAt: ts,
    };
    expect(parseOrThrow(ProjectSchema, project).name).toBe("Promo");
    expect(() => parseOrThrow(ProjectSchema, { ...project, name: "" })).toThrow(
      ValidationError,
    );
  });
});

describe("ApiErrorSchema", () => {
  it("requires request_id", () => {
    expect(
      validate(ApiErrorSchema, {
        code: "x",
        message: "y",
        request_id: "r1",
      }).success,
    ).toBe(true);
    expect(
      validate(ApiErrorSchema, { code: "x", message: "y" }).success,
    ).toBe(false);
  });
});

describe("password strength helper", () => {
  it("scores passwords", async () => {
    const { scorePasswordStrength } = await import("./schemas.js");
    expect(scorePasswordStrength("ab").label).toBe("too short");
    expect(scorePasswordStrength("Abcdef1!").label).toBe("too short");
    expect(scorePasswordStrength("Abcdef12!x").score).toBeGreaterThanOrEqual(2);
  });
});
