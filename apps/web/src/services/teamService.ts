import { apiFetch } from "@/lib/api";
import { TeamMember } from "@/types";

export interface InviteMemberPayload {
  email: string;
  role: "admin" | "agent" | string;
}

export interface InviteResponse {
  id: string;
  invite_link: string;
  email: string;
  role: string;
}

export const teamService = {
  async getMembers(workspaceId?: string): Promise<TeamMember[]> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<TeamMember[]>("/settings/team", { headers });
  },

  async inviteMember(payload: InviteMemberPayload, workspaceId?: string): Promise<InviteResponse> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<InviteResponse>("/settings/team/invite", {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  },

  async updateRole(memberId: string, role: string, workspaceId?: string): Promise<TeamMember> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<TeamMember>(`/settings/team/${memberId}/role`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ role }),
    });
  },

  async removeMember(memberId: string, workspaceId?: string): Promise<{ message: string }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ message: string }>(`/settings/team/${memberId}`, {
      method: "DELETE",
      headers,
    });
  },

  async getInviteDetails(token: string): Promise<{ email: string; workspace_name: string; role: string; valid: boolean }> {
    return apiFetch(`/settings/invites/${token}`);
  },

  async acceptInvite(token: string, payload?: { name?: string; password?: string }): Promise<{ status: string }> {
    return apiFetch(`/settings/invites/${token}/accept`, {
      method: "POST",
      body: JSON.stringify(payload || {}),
    });
  },

  async updateStatus(memberId: string, status: string, workspaceId?: string): Promise<{ status: string }> {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ status: string }>(`/settings/team/${memberId}/status`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status }),
    });
  },
};
