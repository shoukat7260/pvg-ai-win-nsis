import {
  APP_ENVIRONMENTS,
  DEFAULT_FEATURE_FLAGS,
  DEFAULT_FRONTEND_CONFIG,
  type AppEnvironment,
  type FeatureFlags,
  type FrontendConfig,
} from "./types.js";

export type EnvSource = Record<string, string | undefined>;

function readString(
  env: EnvSource,
  key: string,
  fallback: string,
): string {
  const v = env[key];
  if (v === undefined || v.trim() === "") return fallback;
  return v.trim();
}

function readBool(env: EnvSource, key: string, fallback: boolean): boolean {
  const v = env[key];
  if (v === undefined || v.trim() === "") return fallback;
  const lower = v.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(lower)) return true;
  if (["0", "false", "no", "off"].includes(lower)) return false;
  return fallback;
}

export function parseAppEnvironment(
  value: string | undefined,
  fallback: AppEnvironment = "development",
): AppEnvironment {
  if (
    value &&
    (APP_ENVIRONMENTS as readonly string[]).includes(value)
  ) {
    return value as AppEnvironment;
  }
  return fallback;
}

/**
 * Parse FEATURE_FLAGS JSON object string.
 * Unknown keys are ignored; invalid JSON falls back to defaults (dev/test)
 * and throws in production/staging (fail closed for malformed flags).
 */
export function parseFeatureFlags(
  raw: string | undefined,
  environment: AppEnvironment,
  defaults: FeatureFlags = { ...DEFAULT_FEATURE_FLAGS },
): FeatureFlags {
  if (raw === undefined || raw.trim() === "") {
    return { ...defaults };
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("FEATURE_FLAGS must be a JSON object");
    }
    const obj = parsed as Record<string, unknown>;
    return {
      security_lab:
        typeof obj.security_lab === "boolean"
          ? obj.security_lab
          : defaults.security_lab,
      cloud_sync:
        typeof obj.cloud_sync === "boolean"
          ? obj.cloud_sync
          : defaults.cloud_sync,
      experimental_timeline:
        typeof obj.experimental_timeline === "boolean"
          ? obj.experimental_timeline
          : defaults.experimental_timeline,
      provider_connections_ui:
        typeof obj.provider_connections_ui === "boolean"
          ? obj.provider_connections_ui
          : defaults.provider_connections_ui,
    };
  } catch (err) {
    if (environment === "production" || environment === "staging") {
      throw new Error(
        `Invalid FEATURE_FLAGS in ${environment}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    return { ...defaults };
  }
}

/**
 * Build frontend config from an env-like map.
 * Only reads public/client-safe keys — never JWT_SECRET, vault keys, or DB URLs.
 */
export function loadFrontendConfig(
  env: EnvSource = {},
): FrontendConfig {
  const environment = parseAppEnvironment(
    env.APP_ENV ?? env.VITE_APP_ENV,
    DEFAULT_FRONTEND_CONFIG.environment,
  );

  const apiBaseUrl = readString(
    env,
    "VITE_API_PUBLIC_URL",
    readString(env, "API_PUBLIC_URL", DEFAULT_FRONTEND_CONFIG.apiBaseUrl),
  );

  const featureFlags = parseFeatureFlags(
    env.VITE_FEATURE_FLAGS ?? env.FEATURE_FLAGS,
    environment,
  );

  return {
    appName: readString(env, "VITE_APP_NAME", readString(env, "APP_NAME", "PVG AI")),
    appVersion: readString(
      env,
      "VITE_APP_VERSION",
      readString(env, "APP_VERSION", "0.1.0"),
    ),
    environment,
    apiBaseUrl: apiBaseUrl.replace(/\/$/, ""),
    apiVersionPrefix: "/api/v1",
    featureFlags,
    defaultConnectivityMode: "LOCAL_ONLY",
    enableDevTools: readBool(
      env,
      "VITE_ENABLE_DEVTOOLS",
      environment === "development" || environment === "test",
    ),
  };
}

/** True when a flag is enabled. */
export function isFeatureEnabled(
  flags: FeatureFlags,
  key: keyof FeatureFlags,
): boolean {
  return flags[key] === true;
}
