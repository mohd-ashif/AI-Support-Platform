import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sourcesService } from "@/services/sourcesService";
import { queryKeys } from "@/lib/queryKeys";

export function useWebSources(workspaceId?: string) {
  return useQuery({
    queryKey: queryKeys.sources.web(workspaceId),
    queryFn: () => sourcesService.getWebSources(workspaceId),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useFileSources(workspaceId?: string) {
  return useQuery({
    queryKey: queryKeys.sources.files(workspaceId),
    queryFn: () => sourcesService.getFileSources(workspaceId),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useCrawlWebSourceMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (url: string) => sourcesService.crawlWebSource(url, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.web(workspaceId) });
    },
  });
}

export function useRecrawlWebSourceMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => sourcesService.recrawlWebSource(sourceId, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.web(workspaceId) });
    },
  });
}

export function useDeleteWebSourceMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => sourcesService.deleteWebSource(sourceId, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.web(workspaceId) });
    },
  });
}

export function useUploadFileSourceMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (file: File) => sourcesService.uploadFileSource(file, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.files(workspaceId) });
    },
  });
}

export function useDeleteFileSourceMutation(workspaceId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (sourceId: string) => sourcesService.deleteFileSource(sourceId, workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sources.files(workspaceId) });
    },
  });
}
