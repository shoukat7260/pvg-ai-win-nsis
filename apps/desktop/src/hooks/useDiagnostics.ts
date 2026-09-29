import { useQuery } from "@tanstack/react-query";
import { diagnosticsService } from "@/services/diagnostics";
import { useAppStore } from "@/state/appStore";

export function useDiagnostics(enabled = true) {
  const setDiagnostics = useAppStore((s) => s.setDiagnostics);
  return useQuery({
    queryKey: ["diagnostics"],
    enabled,
    queryFn: async () => {
      const report = await diagnosticsService.get();
      setDiagnostics(report);
      return report;
    },
  });
}
