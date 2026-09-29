import { describe, expect, it } from "vitest";
import {
  DEFAULT_FEATURE_FLAGS,
  isFeatureEnabled,
  loadFrontendConfig,
  parseAppEnvironment,
  parseFeatureFlags,
} from "./index.js";

describe("parseAppEnvironment", () => {
  it("accepts known envs and falls back", () => {
    expect(parseAppEnvironment("production")).toBe("production");
    expect(parseAppEnvironment("nope")).toBe("development");
  });
});

describe("parseFeatureFlags", () => {
  it("merges JSON flags", () => {
    const flags = parseFeatureFlags(
      '{"security_lab":true,"cloud_sync":false}',
      "development",
    );
    expect(flags.security_lab).toBe(true);
    expect(flags.cloud_sync).toBe(false);
    expect(flags.experimental_timeline).toBe(
      DEFAULT_FEATURE_FLAGS.experimental_timeline,
    );
  });

  it("fails closed in production on bad JSON", () => {
    expect(() => parseFeatureFlags("{", "production")).toThrow(/FEATURE_FLAGS/);
  });

  it("falls back in development on bad JSON", () => {
    expect(parseFeatureFlags("{", "development")).toEqual(
      DEFAULT_FEATURE_FLAGS,
    );
  });
});

describe("loadFrontendConfig", () => {
  it("loads public env without secrets", () => {
    const cfg = loadFrontendConfig({
      APP_ENV: "test",
      API_PUBLIC_URL: "http://localhost:8000/",
      FEATURE_FLAGS: '{"cloud_sync":true}',
      JWT_SECRET: "should-be-ignored",
    });
    expect(cfg.environment).toBe("test");
    expect(cfg.apiBaseUrl).toBe("http://localhost:8000");
    expect(cfg.apiVersionPrefix).toBe("/api/v1");
    expect(cfg.featureFlags.cloud_sync).toBe(true);
    expect(JSON.stringify(cfg)).not.toContain("should-be-ignored");
  });
});

describe("isFeatureEnabled", () => {
  it("checks flags", () => {
    expect(isFeatureEnabled(DEFAULT_FEATURE_FLAGS, "security_lab")).toBe(false);
  });
});
