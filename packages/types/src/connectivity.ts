/**
 * Desktop connectivity modes — UI must remain usable offline for local work.
 */

export type ConnectivityMode =
  | "LOCAL_ONLY"
  | "ONLINE_OPTIONAL"
  | "ONLINE_REQUIRED";

export const CONNECTIVITY_MODES: readonly ConnectivityMode[] = Object.freeze([
  "LOCAL_ONLY",
  "ONLINE_OPTIONAL",
  "ONLINE_REQUIRED",
]);

export function isConnectivityMode(value: unknown): value is ConnectivityMode {
  return (
    typeof value === "string" &&
    (CONNECTIVITY_MODES as readonly string[]).includes(value)
  );
}

export type DiagnosticLevel = "ok" | "warn" | "error" | "unknown";

export interface DiagnosticCheck {
  id: string;
  label: string;
  level: DiagnosticLevel;
  message: string;
  checkedAt: string;
}

export interface Diagnostics {
  appVersion: string;
  platform: string;
  connectivityMode: ConnectivityMode;
  online: boolean;
  checks: DiagnosticCheck[];
  collectedAt: string;
}
