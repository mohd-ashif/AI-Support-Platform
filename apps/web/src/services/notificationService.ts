import { apiFetch } from "@/lib/api";

export interface DBNotification {
  id: string;
  workspace_id: string;
  title: string;
  message: string;
  type: "chat" | "knowledge" | "analytics" | "system" | string;
  read: boolean;
  action_url?: string | null;
  created_at: string;
}

export const notificationService = {
  async getNotifications(workspaceId?: string): Promise<DBNotification[]> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<DBNotification[]>("/notifications", { headers });
  },

  async markAsRead(notificationId: string, workspaceId?: string): Promise<{ message: string }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ message: string }>(`/notifications/${notificationId}/read`, {
      method: "POST",
      headers,
    });
  },

  async markAllAsRead(workspaceId?: string): Promise<{ message: string }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ message: string }>("/notifications/read-all", {
      method: "POST",
      headers,
    });
  },

  async clearNotifications(workspaceId?: string): Promise<{ message: string }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ message: string }>("/notifications", {
      method: "DELETE",
      headers,
    });
  },
};
