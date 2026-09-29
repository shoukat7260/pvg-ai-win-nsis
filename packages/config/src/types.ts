import type { ConnectivityMode } from "@pvg/types";

export type AppEnvironment =
  | "development"
  | "test"
  | "staging"
  | "production";

export const APP_ENVIRONMENTS: readonly AppEnvironment[] = Object.freeze([
  "development",
  "test",
  "staging",
  "production",
]);

/** Client-safe feature flags (never secrets). */
export interface FeatureFlags {
  security_lab: boolean;
  cloud_sync: boolean;
  experimental_timeline: boolean;
  provider_connections_ui: boolean;
}

export const DEFAULT_FEATURE_FLAGS: Readonly<FeatureFlags> = Object.freeze({
  security_lab: false,
  cloud_sync: false,
  experimental_timeline: false,
  provider_connections_ui: false,
});

/**
 * Shared frontend / desktop config surface.
 * Secrets (JWT, vault keys, DB URLs) must NEVER appear here.
 */
export interface FrontendConfig {
  appName: string;
  appVersion: string;
  environment: AppEnvironment;
  apiBaseUrl: string;
  apiVersionPrefix: "/api/v1";
  featureFlags: FeatureFlags;
  defaultConnectivityMode: ConnectivityMode;
  /** Public CORS-allowed origins are server-side only; clients just know their own origin. */
  enableDevTools: boolean;
}

export const DEFAULT_FRONTEND_CONFIG: Readonly<FrontendConfig> = Object.freeze({
  appName: "PVG AI",
  appVersion: "0.1.0",
  environment: "development",
  apiBaseUrl: "http://localhost:8000",
  apiVersionPrefix: "/api/v1",
  featureFlags: { ...DEFAULT_FEATURE_FLAGS },
  defaultConnectivityMode: "LOCAL_ONLY",
  enableDevTools: true,
});
