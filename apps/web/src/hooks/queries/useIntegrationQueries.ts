import { useQuery } from "@tanstack/react-query";
import { integrationService } from "@/services/integrationService";
import { queryKeys } from "@/lib/queryKeys";

export function useIntegrationSnippet(platform: string = "html", workspaceId?: string) {
  return useQuery({
    queryKey: queryKeys.integrations.snippet(platform, workspaceId),
    queryFn: () => integrationService.getSnippet(platform, workspaceId),
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}
