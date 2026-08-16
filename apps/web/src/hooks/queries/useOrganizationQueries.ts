import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSelector } from "react-redux";
import { RootState } from "@/store";
import { teamService, InviteMemberPayload } from "@/services/teamService";
import { queryKeys } from "@/lib/queryKeys";

/**
 * Hook to retrieve active organization/business identity & workspace context.
 */
export function useCurrentOrganization() {
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const workspaces = useSelector((state: RootState) => state.auth.workspaces);

  return {
    organization: selectedWorkspace?.business || null,
    workspace: selectedWorkspace || null,
    workspaces,
    organizationId: selectedWorkspace?.business?.id || selectedWorkspace?.business_id || null,
    workspaceId: selectedWorkspace?.id || null,
    role: selectedWorkspace?.role || "owner",
  };
}

/**
 * Hook to fetch current organization team members.
 */
export function useOrganizationMembers(workspaceId?: string) {
  const { workspaceId: activeWsId } = useCurrentOrganization();
  const targetWsId = workspaceId || activeWsId || undefined;

  return useQuery({
    queryKey: queryKeys.team.members(targetWsId),
    queryFn: () => teamService.getMembers(targetWsId),
    enabled: !!targetWsId,
    staleTime: 30 * 1000,
  });
}

/**
 * Mutation hook to invite a new member to the organization via email.
 */
export function useInviteMember(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { workspaceId: activeWsId } = useCurrentOrganization();
  const targetWsId = workspaceId || activeWsId || undefined;

  return useMutation({
    mutationFn: (payload: InviteMemberPayload) => teamService.inviteMember(payload, targetWsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(targetWsId) });
    },
  });
}

/**
 * Mutation hook to accept an organization invitation token.
 */
export function useAcceptInviteMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ token, name, password }: { token: string; name?: string; password?: string }) =>
      teamService.acceptInvite(token, { name, password }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
    },
  });
}

/**
 * Mutation hook to remove a member from the organization.
 */
export function useRemoveMemberMutation(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { workspaceId: activeWsId } = useCurrentOrganization();
  const targetWsId = workspaceId || activeWsId || undefined;

  return useMutation({
    mutationFn: (memberId: string) => teamService.removeMember(memberId, targetWsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(targetWsId) });
    },
  });
}

/**
 * Mutation hook to toggle a member's status (active / deactivated).
 */
export function useDeactivateMemberMutation(workspaceId?: string) {
  const queryClient = useQueryClient();
  const { workspaceId: activeWsId } = useCurrentOrganization();
  const targetWsId = workspaceId || activeWsId || undefined;

  return useMutation({
    mutationFn: ({ memberId, status }: { memberId: string; status: "active" | "deactivated" | string }) =>
      teamService.updateStatus(memberId, status, targetWsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.team.members(targetWsId) });
    },
  });
}
