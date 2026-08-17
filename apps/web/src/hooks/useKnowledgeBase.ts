import { useState } from "react";
import { useSelector } from "react-redux";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { RootState } from "@/store";
import { knowledgeService, UnifiedKnowledgeSource, AdminSearchResponse } from "@/services/knowledgeService";
import { queryKeys } from "@/lib/queryKeys";

export function useKnowledgeBase(workspaceId?: string) {
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const activeWsId = workspaceId || selectedWorkspace?.id;
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: sources = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["knowledge_sources", activeWsId],
    queryFn: () => knowledgeService.getUnifiedSources(activeWsId),
    enabled: Boolean(activeWsId),
    refetchInterval: 5000, // Poll every 5s for active indexing status updates
  });

  const {
    data: searchResults,
    isLoading: isSearching,
    refetch: executeSearch,
  } = useQuery({
    queryKey: ["knowledge_admin_search", activeWsId, searchQuery],
    queryFn: () => knowledgeService.adminKnowledgeSearch(searchQuery, 5, activeWsId),
    enabled: Boolean(activeWsId && searchQuery.trim().length >= 2),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => knowledgeService.uploadDocument(file, activeWsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge_sources", activeWsId] });
    },
  });

  const genericSourceMutation = useMutation({
    mutationFn: (payload: { type: string; name: string; content?: string; url?: string }) =>
      knowledgeService.createGenericSource(payload, activeWsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge_sources", activeWsId] });
    },
  });

  const reindexMutation = useMutation({
    mutationFn: (sourceId: string) => knowledgeService.reindexSource(sourceId, activeWsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge_sources", activeWsId] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (sourceId: string) => knowledgeService.deleteSource(sourceId, activeWsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge_sources", activeWsId] });
    },
  });

  const uploadDocument = async (file: File) => uploadMutation.mutateAsync(file);
  const addUrlSource = async (url: string) => genericSourceMutation.mutateAsync({ type: "URL", name: url, url });
  const addFaqSource = async (question: string, answer: string) =>
    genericSourceMutation.mutateAsync({ type: "FAQ", name: question, content: `Q: ${question}\nA: ${answer}` });
  const addArticleSource = async (title: string, body: string) =>
    genericSourceMutation.mutateAsync({ type: "ARTICLE", name: title, content: body });
  const reindexSource = async (sourceId: string) => reindexMutation.mutateAsync(sourceId);
  const deleteSource = async (sourceId: string) => deleteMutation.mutateAsync(sourceId);

  return {
    sources,
    isLoading,
    isUploading: uploadMutation.isPending,
    isCreatingSource: genericSourceMutation.isPending,
    isReindexing: reindexMutation.isPending,
    searchQuery,
    setSearchQuery,
    searchResults,
    isSearching,
    uploadDocument,
    addUrlSource,
    addFaqSource,
    addArticleSource,
    reindexSource,
    deleteSource,
    refresh: refetch,
    executeSearch,
  };
}
