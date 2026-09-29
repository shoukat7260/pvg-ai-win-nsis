import type { ConnectivityMode } from "@/types";

export function describeConnectivity(mode: ConnectivityMode): string {
  switch (mode) {
    case "LOCAL_ONLY":
      return "Local foundation — no network required";
    case "ONLINE_OPTIONAL":
      return "Online features optional";
    case "ONLINE_REQUIRED":
      return "Requires network (Phase 2+)";
  }
}

export function canUseLocalFoundation(mode: ConnectivityMode): boolean {
  return mode === "LOCAL_ONLY" || mode === "ONLINE_OPTIONAL";
}
