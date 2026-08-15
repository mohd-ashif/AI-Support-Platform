import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { workspaceService, SetupWorkspacePayload } from "@/services/workspaceService";
import { queryKeys } from "@/lib/queryKeys";

export function useWorkspaces(enabled: boolean = true) {
  return useQuery({
    queryKey: queryKeys.workspaces.list(),
    queryFn: () => workspaceService.getWorkspaces(),
    enabled,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useSetupWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SetupWorkspacePayload) => workspaceService.setupWorkspace(payload),
    onSuccess: (newWorkspace) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list() });
    },
  });
}

export function useCreateWorkspaceMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: SetupWorkspacePayload) => workspaceService.createWorkspace(payload),
    onSuccess: (newWorkspace) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workspaces.list() });
    },
  });
}
