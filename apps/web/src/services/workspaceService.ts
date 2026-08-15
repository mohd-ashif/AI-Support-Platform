import { apiFetch } from "@/lib/api";
import { Workspace } from "@/types";

export interface SetupWorkspacePayload {
  business_name: string;
  website_url?: string;
  industry?: string;
  logo_url?: string;
}

export const workspaceService = {
  async getWorkspaces(): Promise<Workspace[]> {
    return apiFetch<Workspace[]>("/workspaces");
  },

  async getWorkspace(id: string): Promise<Workspace> {
    return apiFetch<Workspace>(`/workspaces/${id}`);
  },

  async setupWorkspace(payload: SetupWorkspacePayload): Promise<Workspace> {
    return apiFetch<Workspace>("/workspaces/setup", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async createWorkspace(payload: SetupWorkspacePayload): Promise<Workspace> {
    return apiFetch<Workspace>("/workspaces", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },
};
