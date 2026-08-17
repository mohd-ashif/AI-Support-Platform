import { apiFetch } from "@/lib/api";

export interface UnifiedKnowledgeSource {
  id: string;
  workspace_id: string;
  type: "FILE" | "URL" | "FAQ" | "ARTICLE" | "CSV" | "MARKDOWN";
  name: string;
  status: "UPLOADING" | "PROCESSING" | "INDEXING" | "READY" | "FAILED" | "DISABLED" | string;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AdminSearchResult {
  chunk_id: string;
  source_id: string;
  document_id?: string;
  content: string;
  similarity_score: number;
  document_name: string;
  page_number?: number;
  section?: string;
  url?: string;
}

export interface AdminSearchResponse {
  query: string;
  maxConfidence: number;
  results: AdminSearchResult[];
}

export const knowledgeService = {
  getUnifiedSources: async (workspaceId?: string): Promise<UnifiedKnowledgeSource[]> => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<UnifiedKnowledgeSource[]>("/knowledge/sources", { headers });
  },

  createGenericSource: async (
    payload: { type: string; name: string; content?: string; url?: string; metadata?: Record<string, any> },
    workspaceId?: string
  ) => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch("/knowledge/sources", {
      method: "POST",
      body: JSON.stringify(payload),
      headers,
    });
  },

  uploadDocument: async (file: File, workspaceId?: string) => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    const formData = new FormData();
    formData.append("file", file);

    return apiFetch("/knowledge/documents", {
      method: "POST",
      body: formData,
      headers,
    });
  },

  reindexSource: async (sourceId: string, workspaceId?: string) => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch(`/knowledge/sources/${sourceId}/reindex`, {
      method: "POST",
      headers,
    });
  },

  deleteSource: async (sourceId: string, workspaceId?: string) => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch(`/knowledge/sources/${sourceId}`, {
      method: "DELETE",
      headers,
    });
  },

  adminKnowledgeSearch: async (query: string, topK: number = 5, workspaceId?: string): Promise<AdminSearchResponse> => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<AdminSearchResponse>(`/knowledge/search?q=${encodeURIComponent(query)}&top_k=${topK}`, {
      headers,
    });
  },
};
