import { apiFetch } from "@/lib/api";
import { APIKeyItem } from "@/types";

export interface CreateApiKeyPayload {
  label: string;
}

export interface CreateApiKeyResponse extends APIKeyItem {
  raw_key: string;
}

export const settingsService = {
  async getApiKeys(workspaceId?: string): Promise<APIKeyItem[]> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<APIKeyItem[]>("/settings/api-keys", { headers });
  },

  async createApiKey(payload: CreateApiKeyPayload, workspaceId?: string): Promise<CreateApiKeyResponse> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<CreateApiKeyResponse>("/settings/api-keys", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  },

  async revokeApiKey(keyId: string, workspaceId?: string): Promise<{ message: string }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ message: string }>(`/settings/api-keys/${keyId}`, {
      method: "DELETE",
      headers,
    });
  },
};
