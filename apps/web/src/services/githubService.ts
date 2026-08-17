import { apiFetch } from "@/lib/api";

export interface GitHubConnection {
  id: string;
  workspace_id: string;
  github_user_id: string;
  github_username: string;
  github_avatar_url?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface GitHubRepositoryItem {
  id: string;
  name: string;
  full_name: string;
  owner: string;
  is_private: boolean;
  description?: string;
  default_branch: string;
  updated_at?: string;
  html_url?: string;
}

export interface GitHubRepositoriesResponse {
  repositories: GitHubRepositoryItem[];
  page: number;
  per_page: number;
  total_count: number;
}

export interface GitHubBranchItem {
  name: string;
  commit_sha?: string;
  is_protected?: boolean;
}

export interface ConnectedRepo {
  id: string;
  repository_id: string;
  repository_name: string;
  owner: string;
  branch: string;
  default_branch: string;
  is_private: boolean;
  sync_status: string;
  sync_config?: {
    sync_readme?: boolean;
    sync_markdown?: boolean;
    sync_docs?: boolean;
    sync_issues?: boolean;
    sync_pull_requests?: boolean;
    include_extensions?: string[];
    ignore_patterns?: string[];
  };
  last_synced_commit?: string;
  last_synced_at?: string;
  created_at: string;
}

export interface ConnectRepoPayload {
  repository_id: string;
  repository_name: string;
  owner: string;
  branch: string;
  default_branch: string;
  is_private: boolean;
  sync_config: {
    sync_readme: boolean;
    sync_markdown: boolean;
    sync_docs: boolean;
    sync_issues: boolean;
    sync_pull_requests: boolean;
    include_extensions: string[];
    ignore_patterns: string[];
  };
}

export const githubService = {
  getAuthUrl: async (workspaceId?: string): Promise<{ url: string }> => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ url: string }>("/integrations/github/auth-url", { headers });
  },

  getConnection: async (workspaceId?: string): Promise<GitHubConnection | null> => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<GitHubConnection | null>("/integrations/github/connection", { headers });
  },

  disconnect: async (workspaceId?: string): Promise<{ status: string }> => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ status: string }>("/integrations/github/connection", {
      method: "DELETE",
      headers,
    });
  },

  getRepositories: async (
    page: number = 1,
    perPage: number = 20,
    search: string = "",
    workspaceId?: string
  ): Promise<GitHubRepositoriesResponse> => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    const searchParam = search ? `&search=${encodeURIComponent(search)}` : "";
    return apiFetch<GitHubRepositoriesResponse>(
      `/integrations/github/repositories?page=${page}&per_page=${perPage}${searchParam}`,
      { headers }
    );
  },

  getBranches: async (
    owner: string,
    repo: string,
    workspaceId?: string
  ): Promise<GitHubBranchItem[]> => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<GitHubBranchItem[]>(
      `/integrations/github/repositories/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/branches`,
      { headers }
    );
  },

  connectRepo: async (payload: ConnectRepoPayload, workspaceId?: string): Promise<ConnectedRepo> => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<ConnectedRepo>("/integrations/github/connect-repo", {
      method: "POST",
      body: JSON.stringify(payload),
      headers,
    });
  },

  getConnectedRepos: async (workspaceId?: string): Promise<ConnectedRepo[]> => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<ConnectedRepo[]>("/integrations/github/connected-repos", { headers });
  },

  disconnectRepo: async (repoId: string, workspaceId?: string): Promise<{ status: string }> => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ status: string }>(`/integrations/github/connected-repos/${repoId}`, {
      method: "DELETE",
      headers,
    });
  },

  triggerSync: async (repoId: string, workspaceId?: string): Promise<{ status: string; sync_job_id: string }> => {
    const headers: Record<string, string> = {};
    if (workspaceId) headers["X-Workspace-Id"] = workspaceId;
    return apiFetch<{ status: string; sync_job_id: string }>(
      `/integrations/github/repositories/${repoId}/sync`,
      { method: "POST", headers }
    );
  },
};
