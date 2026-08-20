import { apiFetch, getMemoryAccessToken, getMemoryWorkspaceId, API_BASE_URL } from "@/lib/api";
import { WebSource, FileSource } from "@/types";

export interface CloudinarySignatureResponse {
  cloud_name: string;
  api_key: string;
  timestamp: number;
  signature: string;
  folder: string;
}

export const sourcesService = {
  async getWebSources(workspaceId?: string): Promise<WebSource[]> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<WebSource[]>("/sources/web", { headers });
  },

  async crawlWebSource(url: string, workspaceId?: string): Promise<WebSource> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<WebSource>("/sources/web", {
      method: "POST",
      headers,
      body: JSON.stringify({ url }),
    });
  },

  async recrawlWebSource(sourceId: string, workspaceId?: string): Promise<WebSource> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<WebSource>(`/sources/web/${sourceId}/recrawl`, {
      method: "POST",
      headers,
    });
  },

  async deleteWebSource(sourceId: string, workspaceId?: string): Promise<{ message: string }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ message: string }>(`/sources/web/${sourceId}`, {
      method: "DELETE",
      headers,
    });
  },

  async getFileSources(workspaceId?: string): Promise<FileSource[]> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<FileSource[]>("/sources/files", { headers });
  },

  async getCloudinarySignature(): Promise<CloudinarySignatureResponse> {
    return apiFetch<CloudinarySignatureResponse>("/uploads/cloudinary-signature");
  },

  async uploadFileSource(file: File, workspaceId?: string): Promise<FileSource> {
    const formData = new FormData();
    formData.append("file", file);

    const token = getMemoryAccessToken();
    const activeWsId = workspaceId || getMemoryWorkspaceId() || "";
    const apiBase = API_BASE_URL;

    const res = await fetch(`${apiBase}/sources/files`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(activeWsId ? { "X-Workspace-Id": activeWsId } : {}),
      },
      body: formData,
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ detail: "File upload failed" }));
      throw new Error(errData.detail || "File upload failed.");
    }

    return res.json();
  },

  async deleteFileSource(sourceId: string, workspaceId?: string): Promise<{ message: string }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ message: string }>(`/sources/files/${sourceId}`, {
      method: "DELETE",
      headers,
    });
  },
};
