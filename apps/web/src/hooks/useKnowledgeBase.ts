import { useSelector } from "react-redux";
import { RootState } from "@/store";
import {
  useWebSources,
  useFileSources,
  useCrawlWebSourceMutation,
  useUploadFileSourceMutation,
  useDeleteWebSourceMutation,
  useDeleteFileSourceMutation,
} from "@/hooks/queries/useSourcesQueries";
import { formatBytes } from "@/lib/utils/format";
import { KnowledgeSourceItem } from "@/features/knowledge-base/SourcesListTable";

/**
 * Unified Knowledge Base & RAG Training Feature Hook.
 * Connects page UI components to server API state via TanStack Query.
 */
export function useKnowledgeBase(workspaceId?: string) {
  const selectedWorkspace = useSelector((state: RootState) => state.auth.selectedWorkspace);
  const activeWsId = workspaceId || selectedWorkspace?.id;

  const { data: webSources = [], isLoading: loadingWeb, refetch: refetchWeb } = useWebSources(activeWsId);
  const { data: fileSources = [], isLoading: loadingFiles, refetch: refetchFiles } = useFileSources(activeWsId);

  const crawlMutation = useCrawlWebSourceMutation(activeWsId);
  const uploadMutation = useUploadFileSourceMutation(activeWsId);
  const deleteWebMutation = useDeleteWebSourceMutation(activeWsId);
  const deleteFileMutation = useDeleteFileSourceMutation(activeWsId);

  const isLoading = loadingWeb || loadingFiles;
  const isActionPending =
    crawlMutation.isPending ||
    uploadMutation.isPending ||
    deleteWebMutation.isPending ||
    deleteFileMutation.isPending;

  const allSources: KnowledgeSourceItem[] = [
    ...webSources.map((s) => ({
      id: s.id,
      type: "web" as const,
      name: s.url,
      info: `${s.page_count || 0} pages indexed`,
      status: s.status,
    })),
    ...fileSources.map((s) => ({
      id: s.id,
      type: "file" as const,
      name: s.filename,
      info: formatBytes(s.file_size_bytes || 0),
      status: s.status,
    })),
  ];

  const crawlWebsite = async (url: string) => {
    return crawlMutation.mutateAsync(url);
  };

  const uploadDocument = async (file: File) => {
    return uploadMutation.mutateAsync(file);
  };

  const deleteSource = async (id: string, type: "web" | "file") => {
    if (type === "web") {
      return deleteWebMutation.mutateAsync(id);
    }
    return deleteFileMutation.mutateAsync(id);
  };

  const refresh = () => {
    refetchWeb();
    refetchFiles();
  };

  return {
    webSources,
    fileSources,
    allSources,
    isLoading,
    isActionPending,
    isCrawling: crawlMutation.isPending,
    isUploading: uploadMutation.isPending,
    crawlWebsite,
    uploadDocument,
    deleteSource,
    refresh,
  };
}
