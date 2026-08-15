import { apiFetch } from "@/lib/api";
import { AnalyticsSummary } from "@/types";

export const analyticsService = {
  async getSummary(range: string = "7d", workspaceId?: string, signal?: AbortSignal): Promise<AnalyticsSummary> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<AnalyticsSummary>(`/analytics/summary?range=${encodeURIComponent(range)}`, {
      headers,
      signal,
    });
  },
};
