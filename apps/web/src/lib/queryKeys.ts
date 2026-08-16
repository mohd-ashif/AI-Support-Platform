/**
 * Centralized Query Keys Factory for SupportAI Platform
 * Ensures predictable cache keys and targeted invalidations across TanStack Query.
 */

export const queryKeys = {
  auth: {
    all: ["auth"] as const,
    user: () => [...queryKeys.auth.all, "user"] as const,
    workspaces: () => [...queryKeys.auth.all, "workspaces"] as const,
  },
  workspaces: {
    all: ["workspaces"] as const,
    list: () => [...queryKeys.workspaces.all, "list"] as const,
    detail: (id: string) => [...queryKeys.workspaces.all, "detail", id] as const,
  },
  team: {
    all: ["team"] as const,
    members: (workspaceId?: string) => [...queryKeys.team.all, "members", workspaceId || "default"] as const,
    invites: (workspaceId?: string) => [...queryKeys.team.all, "invites", workspaceId || "default"] as const,
  },
  sources: {
    all: ["sources"] as const,
    web: (workspaceId?: string) => [...queryKeys.sources.all, "web", workspaceId || "default"] as const,
    files: (workspaceId?: string) => [...queryKeys.sources.all, "files", workspaceId || "default"] as const,
  },
  billing: {
    all: ["billing"] as const,
    plans: () => [...queryKeys.billing.all, "plans"] as const,
    subscription: (workspaceId?: string) => [...queryKeys.billing.all, "subscription", workspaceId || "default"] as const,
  },
  analytics: {
    all: ["analytics"] as const,
    summary: (workspaceId: string, range: string) => [...queryKeys.analytics.all, "summary", workspaceId, range] as const,
  },
  inbox: {
    all: ["inbox"] as const,
    conversations: (workspaceId?: string) => [...queryKeys.inbox.all, "conversations", workspaceId || "default"] as const,
    messages: (conversationId?: string) => [...queryKeys.inbox.all, "messages", conversationId || "default"] as const,
  },
  widget: {
    all: ["widget"] as const,
    config: (workspaceId?: string) => [...queryKeys.widget.all, "config", workspaceId || "default"] as const,
  },
  settings: {
    all: ["settings"] as const,
    apiKeys: (workspaceId?: string) => [...queryKeys.settings.all, "apiKeys", workspaceId || "default"] as const,
  },
  integrations: {
    all: ["integrations"] as const,
    snippet: (platform: string, workspaceId?: string) => [...queryKeys.integrations.all, "snippet", platform, workspaceId || "default"] as const,
  },
  notifications: {
    all: ["notifications"] as const,
    list: (workspaceId?: string) => [...queryKeys.notifications.all, "list", workspaceId || "default"] as const,
  },
};
