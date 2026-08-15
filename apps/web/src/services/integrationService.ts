import { apiFetch } from "@/lib/api";

export interface IntegrationSnippetResponse {
  platform: string;
  snippet?: string;
  snippet_code?: string;
  instructions?: string;
}

export const integrationService = {
  async getSnippet(platform: string = "html", workspaceId?: string): Promise<IntegrationSnippetResponse> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<IntegrationSnippetResponse>(`/integrations/snippet?platform=${encodeURIComponent(platform)}`, {
      headers,
    });
  },

  async getPublicMessages(embedUuid: string, convId: string): Promise<any[]> {
    return apiFetch(`/public/${embedUuid}/conversations/${convId}/messages`);
  },

  async createPublicConversation(embedUuid: string, visitorId: string): Promise<{ conversation_id: string }> {
    return apiFetch(`/public/${embedUuid}/conversations`, {
      method: "POST",
      body: JSON.stringify({ visitor_id: visitorId }),
    });
  },

  async sendPublicMessage(embedUuid: string, convId: string, visitorId: string, content: string): Promise<any> {
    return apiFetch(`/public/${embedUuid}/conversations/${convId}/messages`, {
      method: "POST",
      body: JSON.stringify({ visitor_id: visitorId, content }),
    });
  },
};
