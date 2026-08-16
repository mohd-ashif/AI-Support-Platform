import {
  useOrganizationMembers,
  useInviteMember,
  useRemoveMemberMutation,
  useDeactivateMemberMutation,
} from "@/hooks/queries/useOrganizationQueries";

/**
 * Unified Organization Team Members & Invites Feature Hook.
 */
export function useTeamMembers(workspaceId?: string) {
  const { data: members = [], isLoading, refetch } = useOrganizationMembers(workspaceId);

  const inviteMutation = useInviteMember(workspaceId);
  const removeMutation = useRemoveMemberMutation(workspaceId);
  const deactivateMutation = useDeactivateMemberMutation(workspaceId);

  const inviteMember = async (email: string, role: string) => {
    return inviteMutation.mutateAsync({ email, role });
  };

  const removeMember = async (memberId: string) => {
    return removeMutation.mutateAsync(memberId);
  };

  const toggleStatus = async (memberId: string, status: "active" | "deactivated") => {
    return deactivateMutation.mutateAsync({ memberId, status });
  };

  return {
    members,
    isLoading,
    isInviting: inviteMutation.isPending,
    isRemoving: removeMutation.isPending,
    isDeactivating: deactivateMutation.isPending,
    inviteMember,
    removeMember,
    toggleStatus,
    refetch,
  };
}
