from typing import Callable, Set, Dict
from fastapi import Depends, HTTPException, status
from apps.api.src.dependencies.tenant import get_tenant_context, TenantContext
from apps.api.src.models.core import TeamMember


class Permissions:
    CONVERSATIONS_READ = "conversations:read"
    CONVERSATIONS_REPLY = "conversations:reply"
    CONVERSATIONS_ASSIGN = "conversations:assign"
    CONVERSATIONS_RESOLVE = "conversations:resolve"

    KNOWLEDGE_READ = "knowledge:read"
    KNOWLEDGE_MANAGE = "knowledge:manage"

    ANALYTICS_READ = "analytics:read"

    TEAM_READ = "team:read"
    TEAM_INVITE = "team:invite"
    TEAM_UPDATE = "team:update"
    TEAM_REMOVE = "team:remove"

    BILLING_READ = "billing:read"
    BILLING_MANAGE = "billing:manage"

    WIDGET_READ = "widget:read"
    WIDGET_MANAGE = "widget:manage"

    SETTINGS_READ = "settings:read"
    SETTINGS_MANAGE = "settings:manage"

    INTEGRATIONS_READ = "integrations:read"
    INTEGRATIONS_MANAGE = "integrations:manage"


# Role Permission Mapping Matrix
ROLE_PERMISSIONS_MAP: Dict[str, Set[str]] = {
    "owner": {
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
    },
    "admin": {
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
    },
    "manager": {
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
    },
    "agent": {
        Permissions.CONVERSATIONS_READ,
        Permissions.CONVERSATIONS_REPLY,
        Permissions.CONVERSATIONS_ASSIGN,
        Permissions.CONVERSATIONS_RESOLVE,
        Permissions.KNOWLEDGE_READ,
        Permissions.ANALYTICS_READ,
        Permissions.TEAM_READ,
        Permissions.WIDGET_READ,
    },
    "viewer": {
        Permissions.CONVERSATIONS_READ,
        Permissions.KNOWLEDGE_READ,
        Permissions.ANALYTICS_READ,
        Permissions.TEAM_READ,
        Permissions.WIDGET_READ,
        Permissions.SETTINGS_READ,
        Permissions.INTEGRATIONS_READ,
    },
}


def has_role_permission(role: str, permission: str) -> bool:
    """Check if a given role string possesses the specified permission."""
    role_normalized = (role or "").strip().lower()
    allowed_perms = ROLE_PERMISSIONS_MAP.get(role_normalized, set())
    return permission in allowed_perms


def require_permission(permission: str) -> Callable:
    """
    FastAPI dependency factory for centralized RBAC permission authorization.
    Verifies that the authenticated tenant user's role possesses the required permission.
    """
    async def permission_dependency(
        tenant: TenantContext = Depends(get_tenant_context),
    ) -> TenantContext:
        user_role = (tenant.role or "").strip().lower()

        if not has_role_permission(user_role, permission):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required permission '{permission}' is not granted to role '{user_role}'.",
            )
        return tenant

    return permission_dependency
