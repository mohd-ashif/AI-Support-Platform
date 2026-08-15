import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { settingsService, CreateApiKeyPayload } from "@/services/settingsService";
import { queryKeys } from "@/lib/queryKeys";

export function useApiKeys(workspaceId?: string) {
  return useQuery({
    queryKey: queryKeys.settings.apiKeys(workspaceId),
    queryFn: () => settingsService.getApiKeys(workspaceId),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useCreateApiKeyMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateApiKeyPayload) => settingsService.createApiKey(payload, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys(workspaceId) });
    },
  });
}

export function useRevokeApiKeyMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyId: string) => settingsService.revokeApiKey(keyId, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.settings.apiKeys(workspaceId) });
    },
  });
}
