import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { widgetService, UpdateWidgetPayload } from "@/services/widgetService";
import { queryKeys } from "@/lib/queryKeys";

export function useWidgetConfig(workspaceId?: string) {
  return useQuery({
    queryKey: queryKeys.widget.config(workspaceId),
    queryFn: () => widgetService.getConfig(workspaceId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useUpdateWidgetConfigMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateWidgetPayload) => widgetService.updateConfig(payload, workspaceId),
    onSuccess: (updatedConfig) => {
      queryClient.setQueryData(queryKeys.widget.config(workspaceId), updatedConfig);
      queryClient.invalidateQueries({ queryKey: queryKeys.widget.config(workspaceId) });
    },
  });
}
