import { useQuery } from "@tanstack/react-query";
import { analyticsService } from "@/services/analyticsService";
import { queryKeys } from "@/lib/queryKeys";

export function useAnalyticsSummary(range: "7d" | "30d" | "90d" = "7d", workspaceId?: string) {
  const activeWsId = workspaceId || "default";

  return useQuery({
    queryKey: queryKeys.analytics.summary(activeWsId, range),
    queryFn: ({ signal }) => analyticsService.getSummary(range, workspaceId, signal),
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });
}
