export const Permissions = {
  CONVERSATIONS_READ: "conversations:read",
  CONVERSATIONS_REPLY: "conversations:reply",
  CONVERSATIONS_ASSIGN: "conversations:assign",
  CONVERSATIONS_RESOLVE: "conversations:resolve",

  KNOWLEDGE_READ: "knowledge:read",
  KNOWLEDGE_MANAGE: "knowledge:manage",

  ANALYTICS_READ: "analytics:read",

  TEAM_READ: "team:read",
  TEAM_INVITE: "team:invite",
  TEAM_UPDATE: "team:update",
  TEAM_REMOVE: "team:remove",

  BILLING_READ: "billing:read",
  BILLING_MANAGE: "billing:manage",

  WIDGET_READ: "widget:read",
  WIDGET_MANAGE: "widget:manage",

  SETTINGS_READ: "settings:read",
  SETTINGS_MANAGE: "settings:manage",

  INTEGRATIONS_READ: "integrations:read",
  INTEGRATIONS_MANAGE: "integrations:manage",
} as const;

export const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  owner: [
    Permissions.CONVERSATIONS_READ,
    Permissions.CONVERSATIONS_REPLY,
    Permissions.CONVERSATIONS_ASSIGN,
    Permissions.CONVERSATIONS_RESOLVE,
    Permissions.KNOWLEDGE_READ,
    Permissions.KNOWLEDGE_MANAGE,
    Permissions.ANALYTICS_READ,
    Permissions.TEAM_READ,
    Permissions.TEAM_INVITE,
    Permissions.TEAM_UPDATE,
    Permissions.TEAM_REMOVE,
    Permissions.BILLING_READ,
    Permissions.BILLING_MANAGE,
    Permissions.WIDGET_READ,
    Permissions.WIDGET_MANAGE,
    Permissions.SETTINGS_READ,
    Permissions.SETTINGS_MANAGE,
    Permissions.INTEGRATIONS_READ,
    Permissions.INTEGRATIONS_MANAGE,
  ],
  admin: [
    Permissions.CONVERSATIONS_READ,
    Permissions.CONVERSATIONS_REPLY,
    Permissions.CONVERSATIONS_ASSIGN,
    Permissions.CONVERSATIONS_RESOLVE,
    Permissions.KNOWLEDGE_READ,
    Permissions.KNOWLEDGE_MANAGE,
    Permissions.ANALYTICS_READ,
    Permissions.TEAM_READ,
    Permissions.TEAM_INVITE,
    Permissions.TEAM_UPDATE,
    Permissions.TEAM_REMOVE,
    Permissions.BILLING_READ,
    Permissions.WIDGET_READ,
    Permissions.WIDGET_MANAGE,
    Permissions.SETTINGS_READ,
    Permissions.SETTINGS_MANAGE,
    Permissions.INTEGRATIONS_READ,
    Permissions.INTEGRATIONS_MANAGE,
  ],
  manager: [
    Permissions.CONVERSATIONS_READ,
    Permissions.CONVERSATIONS_REPLY,
    Permissions.CONVERSATIONS_ASSIGN,
    Permissions.CONVERSATIONS_RESOLVE,
    Permissions.KNOWLEDGE_READ,
    Permissions.ANALYTICS_READ,
    Permissions.TEAM_READ,
    Permissions.TEAM_INVITE,
    Permissions.WIDGET_READ,
    Permissions.SETTINGS_READ,
    Permissions.INTEGRATIONS_READ,
  ],
  agent: [
    Permissions.CONVERSATIONS_READ,
    Permissions.CONVERSATIONS_REPLY,
    Permissions.CONVERSATIONS_ASSIGN,
    Permissions.CONVERSATIONS_RESOLVE,
    Permissions.KNOWLEDGE_READ,
    Permissions.ANALYTICS_READ,
    Permissions.TEAM_READ,
    Permissions.WIDGET_READ,
  ],
  viewer: [
    Permissions.CONVERSATIONS_READ,
    Permissions.KNOWLEDGE_READ,
    Permissions.ANALYTICS_READ,
    Permissions.TEAM_READ,
    Permissions.WIDGET_READ,
    Permissions.SETTINGS_READ,
    Permissions.INTEGRATIONS_READ,
  ],
};

export function hasPermission(role?: string | null, permission?: string): boolean {
  if (!role || !permission) return false;
  const roleNorm = role.trim().toLowerCase();
  const allowed = ROLE_PERMISSIONS_MAP[roleNorm] || [];
  return allowed.includes(permission);
}
