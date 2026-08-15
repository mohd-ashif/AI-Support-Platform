import { apiFetch } from "@/lib/api";

export interface Conversation {
  id: string;
  workspace_id: string;
  visitor_id: string;
  status: "bot" | "human" | "resolved" | string;
  assigned_agent_id?: string | null;
  last_message_preview?: string | null;
  last_message_at?: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: "visitor" | "bot" | "agent";
  sender_name?: string | null;
  content: string;
  created_at: string;
}

export const inboxService = {
  async getConversations(workspaceId?: string): Promise<Conversation[]> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<Conversation[]>("/inbox/conversations", { headers });
  },

  async getMessages(conversationId: string, workspaceId?: string): Promise<Message[]> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<Message[]>(`/inbox/conversations/${conversationId}/messages`, { headers });
  },

  async sendMessage(conversationId: string, content: string, workspaceId?: string): Promise<Message> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<Message>(`/inbox/conversations/${conversationId}/reply`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content }),
    });
  },

  async takeoverConversation(conversationId: string, workspaceId?: string): Promise<Conversation> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<Conversation>(`/inbox/conversations/${conversationId}/takeover`, {
      method: "POST",
      headers,
    });
  },

  async resolveConversation(conversationId: string, workspaceId?: string): Promise<Conversation> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<Conversation>(`/inbox/conversations/${conversationId}/resolve`, {
      method: "POST",
      headers,
    });
  },

  async clearPreviewChats(workspaceId?: string): Promise<{ message: string }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ message: string }>("/conversations/clear-preview", {
      method: "DELETE",
      headers,
    });
  },
};
