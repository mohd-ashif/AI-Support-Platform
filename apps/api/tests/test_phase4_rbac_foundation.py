import pytest
import pytest_asyncio
from fastapi import HTTPException

from apps.api.src.models.core import User, Business, Workspace, TeamMember, generate_uuid
from apps.api.src.dependencies.tenant import TenantContext
from apps.api.src.dependencies.rbac import (
    Permissions,
    has_role_permission,
    require_permission,
    ROLE_PERMISSIONS_MAP,
)


@pytest.mark.asyncio
async def test_agent_role_permissions():
    """Verify Agent role permissions: can reply, cannot manage billing or knowledge."""
    assert has_role_permission("agent", Permissions.CONVERSATIONS_READ) is True
    assert has_role_permission("agent", Permissions.CONVERSATIONS_REPLY) is True
    assert has_role_permission("agent", Permissions.CONVERSATIONS_ASSIGN) is True
    assert has_role_permission("agent", Permissions.ANALYTICS_READ) is True

    # Negative assertions for Agent
    assert has_role_permission("agent", Permissions.BILLING_MANAGE) is False
    assert has_role_permission("agent", Permissions.KNOWLEDGE_MANAGE) is False
    assert has_role_permission("agent", Permissions.TEAM_INVITE) is False
    assert has_role_permission("agent", Permissions.SETTINGS_MANAGE) is False


@pytest.mark.asyncio
async def test_viewer_role_permissions():
    """Verify Viewer role permissions: read-only access, cannot modify settings or reply."""
    assert has_role_permission("viewer", Permissions.CONVERSATIONS_READ) is True
    assert has_role_permission("viewer", Permissions.KNOWLEDGE_READ) is True
    assert has_role_permission("viewer", Permissions.ANALYTICS_READ) is True
    assert has_role_permission("viewer", Permissions.TEAM_READ) is True

    # Negative assertions for Viewer
    assert has_role_permission("viewer", Permissions.CONVERSATIONS_REPLY) is False
    assert has_role_permission("viewer", Permissions.CONVERSATIONS_ASSIGN) is False
    assert has_role_permission("viewer", Permissions.SETTINGS_MANAGE) is False
    assert has_role_permission("viewer", Permissions.BILLING_MANAGE) is False


@pytest.mark.asyncio
async def test_manager_role_permissions():
    """Verify Manager role permissions: support & team invite, cannot manage billing."""
    assert has_role_permission("manager", Permissions.CONVERSATIONS_ASSIGN) is True
    assert has_role_permission("manager", Permissions.TEAM_INVITE) is True
    assert has_role_permission("manager", Permissions.ANALYTICS_READ) is True

    # Negative assertions for Manager
    assert has_role_permission("manager", Permissions.BILLING_MANAGE) is False
    assert has_role_permission("manager", Permissions.KNOWLEDGE_MANAGE) is False


@pytest.mark.asyncio
async def test_admin_role_permissions():
    """Verify Admin role permissions: team management, widget manage, knowledge manage."""
    assert has_role_permission("admin", Permissions.TEAM_INVITE) is True
    assert has_role_permission("admin", Permissions.TEAM_REMOVE) is True
    assert has_role_permission("admin", Permissions.KNOWLEDGE_MANAGE) is True
    assert has_role_permission("admin", Permissions.WIDGET_MANAGE) is True
    assert has_role_permission("admin", Permissions.SETTINGS_MANAGE) is True

    # Negative assertions for Admin
    assert has_role_permission("admin", Permissions.BILLING_MANAGE) is False


@pytest.mark.asyncio
async def test_owner_role_permissions():
    """Verify Owner role permissions: full organization access across all permissions."""
    all_permissions = [
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
    ]
    for perm in all_permissions:
        assert has_role_permission("owner", perm) is True


@pytest.mark.asyncio
async def test_require_permission_dependency_enforcement():
    """Verify require_permission dependency raises HTTP 403 when role lacks permission."""
    user = User(id=generate_uuid(), email="agent@test.com", name="Test Agent")
    biz = Business(id=generate_uuid(), name="Test Org", slug="test-org", owner_user_id=user.id)
    ws = Workspace(id=generate_uuid(), business_id=biz.id, workspace_uuid=generate_uuid())

    # 1. Agent tenant context trying to manage billing
    agent_member = TeamMember(id=generate_uuid(), workspace_id=ws.id, user_id=user.id, role="agent")
    agent_context = TenantContext(user=user, member=agent_member, workspace=ws, business=biz)

    billing_dep = require_permission(Permissions.BILLING_MANAGE)
    with pytest.raises(HTTPException) as exc_info:
        await billing_dep(tenant=agent_context)

    assert exc_info.value.status_code == 403
    assert "Permission denied" in exc_info.value.detail

    # 2. Owner tenant context executing same dependency
    owner_member = TeamMember(id=generate_uuid(), workspace_id=ws.id, user_id=user.id, role="owner")
    owner_context = TenantContext(user=user, member=owner_member, workspace=ws, business=biz)

    passed_context = await billing_dep(tenant=owner_context)
    assert passed_context.role == "owner"
