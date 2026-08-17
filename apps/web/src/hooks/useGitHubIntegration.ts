import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RootState } from "@/store";
import {
  githubService,
  GitHubConnection,
  GitHubRepositoryItem,
  GitHubBranchItem,
  ConnectedRepo,
  ConnectRepoPayload,
} from "@/services/githubService";

export function useGitHubIntegration(workspaceId?: string) {
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const activeWsId = workspaceId || selectedWorkspace?.id || selectedWorkspace?.workspace_id;
  const queryClient = useQueryClient();

  const [repoSearch, setRepoSearch] = useState("");
  const [repoPage, setRepoPage] = useState(1);
  const [selectedRepoForBranch, setSelectedRepoForBranch] = useState<{ owner: string; name: string } | null>(null);

  // 1. Connection Status Query
  const connectionQuery = useQuery<GitHubConnection | null>({
    queryKey: ["github_connection", activeWsId],
    queryFn: () => githubService.getConnection(activeWsId),
    enabled: Boolean(activeWsId),
    staleTime: 0,
  });

  // 2. Connected Repositories Query
  const connectedReposQuery = useQuery<ConnectedRepo[]>({
    queryKey: ["github_connected_repos", activeWsId],
    queryFn: () => githubService.getConnectedRepos(activeWsId),
    enabled: Boolean(activeWsId && connectionQuery.data?.status === "connected"),
    refetchInterval: 6000, // Poll every 6s to update sync progress
  });

  // 3. User Accessible Repositories Query (Paginated & Searched)
  const reposQuery = useQuery({
    queryKey: ["github_user_repos", activeWsId, repoPage, repoSearch],
    queryFn: () => githubService.getRepositories(repoPage, 20, repoSearch, activeWsId),
    enabled: Boolean(activeWsId && connectionQuery.data?.status === "connected"),
  });

  // 4. Branches Query for selected repo
  const branchesQuery = useQuery<GitHubBranchItem[]>({
    queryKey: ["github_repo_branches", activeWsId, selectedRepoForBranch?.owner, selectedRepoForBranch?.name],
    queryFn: () =>
      selectedRepoForBranch
        ? githubService.getBranches(selectedRepoForBranch.owner, selectedRepoForBranch.name, activeWsId)
        : Promise.resolve([]),
    enabled: Boolean(activeWsId && selectedRepoForBranch),
  });

  // Mutations
  const connectOAuthMutation = useMutation({
    mutationFn: async () => {
      const res = await githubService.getAuthUrl(activeWsId);
      if (res?.url) {
        window.location.href = res.url;
      }
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => githubService.disconnect(activeWsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github_connection", activeWsId] });
      queryClient.invalidateQueries({ queryKey: ["github_connected_repos", activeWsId] });
    },
  });

  const connectRepoMutation = useMutation({
    mutationFn: (payload: ConnectRepoPayload) => githubService.connectRepo(payload, activeWsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github_connected_repos", activeWsId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge_sources", activeWsId] });
    },
  });

  const disconnectRepoMutation = useMutation({
    mutationFn: (repoId: string) => githubService.disconnectRepo(repoId, activeWsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github_connected_repos", activeWsId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge_sources", activeWsId] });
    },
  });

  const triggerSyncMutation = useMutation({
    mutationFn: (repoId: string) => githubService.triggerSync(repoId, activeWsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["github_connected_repos", activeWsId] });
    },
  });

  return {
    connection: connectionQuery.data,
    isConnected: connectionQuery.data?.status === "connected",
    isLoadingConnection: connectionQuery.isLoading,
    connectedRepos: connectedReposQuery.data || [],
    isLoadingConnectedRepos: connectedReposQuery.isLoading,
    
    // User repos for selection
    repositories: reposQuery.data?.repositories || [],
    totalRepositories: reposQuery.data?.total_count || 0,
    isLoadingRepositories: reposQuery.isLoading,
    repoPage,
    setRepoPage,
    repoSearch,
    setRepoSearch,

    // Branch selection
    selectedRepoForBranch,
    setSelectedRepoForBranch,
    branches: branchesQuery.data || [],
    isLoadingBranches: branchesQuery.isLoading,

    // Actions
    connectGitHub: connectOAuthMutation.mutateAsync,
    isConnectingGitHub: connectOAuthMutation.isPending,
    disconnectGitHub: disconnectMutation.mutateAsync,
    isDisconnectingGitHub: disconnectMutation.isPending,
    
    connectRepo: connectRepoMutation.mutateAsync,
    isConnectingRepo: connectRepoMutation.isPending,
    
    disconnectRepo: disconnectRepoMutation.mutateAsync,
    isDisconnectingRepo: disconnectRepoMutation.isPending,

    triggerSync: triggerSyncMutation.mutateAsync,
    isSyncingRepo: triggerSyncMutation.isPending,

    refetchConnection: connectionQuery.refetch,
    refetchConnectedRepos: connectedReposQuery.refetch,
  };
}
