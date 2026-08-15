import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { teamService, InviteMemberPayload } from "@/services/teamService";
import { queryKeys } from "@/lib/queryKeys";

export function useTeamMembers(workspaceId?: string) {
  return useQuery({
    queryKey: queryKeys.team.members(workspaceId),
    queryFn: () => teamService.getMembers(workspaceId),
    enabled: true,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}

export function useInviteMemberMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: InviteMemberPayload) => teamService.inviteMember(payload, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(workspaceId) });
    },
  });
}

export function useUpdateTeamRoleMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ memberId, role }: { memberId: string; role: string }) =>
      teamService.updateRole(memberId, role, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(workspaceId) });
    },
  });
}

export function useRemoveTeamMemberMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memberId: string) => teamService.removeMember(memberId, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(workspaceId) });
    },
  });
}
