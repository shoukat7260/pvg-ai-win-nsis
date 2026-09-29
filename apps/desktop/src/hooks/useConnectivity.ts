import { useAppStore } from "@/state/appStore";
import { describeConnectivity } from "@/lib/connectivity";

export function useConnectivity() {
  const connection = useAppStore((s) => s.connectionMetadata);
  return {
    ...connection,
    label: describeConnectivity(connection.mode),
  };
}
