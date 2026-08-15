import { apiFetch } from "@/lib/api";
import { WidgetConfigData } from "@/types";

export interface UpdateWidgetPayload {
  brand_name?: string;
  tagline?: string;
  logo_url?: string;
  primary_color?: string;
  greeting_message?: string;
  content_cards_json?: any[];
}

export const widgetService = {
  async getConfig(workspaceId?: string): Promise<WidgetConfigData> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<WidgetConfigData>("/widget/config", { headers });
  },

  async updateConfig(payload: UpdateWidgetPayload, workspaceId?: string): Promise<WidgetConfigData> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<WidgetConfigData>("/widget/config", {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });
  },
};
