import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select

from apps.api.src.models.core import (
    User,
    Business,
    Workspace,
    TeamMember,
    Conversation,
    SourceWeb,
    generate_uuid,
)
from apps.api.src.dependencies.tenant import TenantContext, get_tenant_context
from apps.api.src.dependencies.rbac import (
    Permissions,
    has_role_permission,
    require_permission,
)
from apps.api.src.repositories.tenant_repository import TenantRepository


@pytest_asyncio.fixture
async def setup_phase5_test_harness(db_session):
    """Fixture creating two distinct tenants (Company A & Company B) with multi-role users."""
    # Organization A Users
    owner_a = User(id=generate_uuid(), email="owner_a@acme.com", name="Owner A")
    agent_a = User(id=generate_uuid(), email="agent_a@acme.com", name="Agent A")
    viewer_a = User(id=generate_uuid(), email="viewer_a@acme.com", name="Viewer A")

    biz_a = Business(id=generate_uuid(), name="Acme Corp", slug="acme-corp", owner_user_id=owner_a.id)
    ws_a = Workspace(id=generate_uuid(), business_id=biz_a.id, workspace_uuid=generate_uuid(), status="active")

    mem_owner_a = TeamMember(id=generate_uuid(), workspace_id=ws_a.id, user_id=owner_a.id, role="owner", status="active")
    mem_agent_a = TeamMember(id=generate_uuid(), workspace_id=ws_a.id, user_id=agent_a.id, role="agent", status="active")
    mem_viewer_a = TeamMember(id=generate_uuid(), workspace_id=ws_a.id, user_id=viewer_a.id, role="viewer", status="active")

    conv_a = Conversation(id=generate_uuid(), workspace_id=ws_a.id, visitor_id="vis_a_123", status="open")
    source_a = SourceWeb(id=generate_uuid(), workspace_id=ws_a.id, url="https://acme.com", status="ready")

    # Organization B Users
    owner_b = User(id=generate_uuid(), email="owner_b@globex.com", name="Owner B")
    biz_b = Business(id=generate_uuid(), name="Globex Inc", slug="globex-inc", owner_user_id=owner_b.id)
    ws_b = Workspace(id=generate_uuid(), business_id=biz_b.id, workspace_uuid=generate_uuid(), status="active")
    mem_owner_b = TeamMember(id=generate_uuid(), workspace_id=ws_b.id, user_id=owner_b.id, role="owner", status="active")

    conv_b = Conversation(id=generate_uuid(), workspace_id=ws_b.id, visitor_id="vis_b_999", status="open")
    source_b = SourceWeb(id=generate_uuid(), workspace_id=ws_b.id, url="https://globex.com", status="ready")

    db_session.add_all([
        owner_a, agent_a, viewer_a, biz_a, ws_a, mem_owner_a, mem_agent_a, mem_viewer_a, conv_a, source_a,
        owner_b, biz_b, ws_b, mem_owner_b, conv_b, source_b,
    ])
    await db_session.commit()

    return {
        "tenant_a": {
            "ws": ws_a,
            "biz": biz_a,
            "conv": conv_a,
            "source": source_a,
            "context_owner": TenantContext(user=owner_a, member=mem_owner_a, workspace=ws_a, business=biz_a),
            "context_agent": TenantContext(user=agent_a, member=mem_agent_a, workspace=ws_a, business=biz_a),
            "context_viewer": TenantContext(user=viewer_a, member=mem_viewer_a, workspace=ws_a, business=biz_a),
        },
        "tenant_b": {
            "ws": ws_b,
            "biz": biz_b,
            "conv": conv_b,
            "source": source_b,
            "context_owner": TenantContext(user=owner_b, member=mem_owner_b, workspace=ws_b, business=biz_b),
        },
    }


@pytest.mark.asyncio
async def test_state1_unauthenticated_request_blocked():
    """Security State 1: Unauthenticated request raises exception / 401/403."""
    with pytest.raises(Exception):
        # Passing None as current user to tenant context resolution
        await get_tenant_context(x_workspace_id="ws_test", current_user=None, db=None)


@pytest.mark.asyncio
async def test_state2_authenticated_without_permission_blocked(setup_phase5_test_harness):
    """Security State 2: Authenticated user without required permission returns 403 Forbidden."""
    context_viewer = setup_phase5_test_harness["tenant_a"]["context_viewer"]
    context_agent = setup_phase5_test_harness["tenant_a"]["context_agent"]

    # 1. Viewer trying to manage knowledge sources
    dep_knowledge = require_permission(Permissions.KNOWLEDGE_MANAGE)
    with pytest.raises(HTTPException) as exc_info:
        await dep_knowledge(tenant=context_viewer)
    assert exc_info.value.status_code == 403
    assert "Permission denied" in exc_info.value.detail

    # 2. Agent trying to manage billing
    dep_billing = require_permission(Permissions.BILLING_MANAGE)
    with pytest.raises(HTTPException) as exc_info:
        await dep_billing(tenant=context_agent)
    assert exc_info.value.status_code == 403
    assert "Permission denied" in exc_info.value.detail


@pytest.mark.asyncio
async def test_state3_correct_permission_granted(setup_phase5_test_harness):
    """Security State 3: User with correct role permission passes authorization check."""
    context_agent = setup_phase5_test_harness["tenant_a"]["context_agent"]
    context_owner = setup_phase5_test_harness["tenant_a"]["context_owner"]

    # 1. Agent reading conversations
    dep_reply = require_permission(Permissions.CONVERSATIONS_REPLY)
    res_agent = await dep_reply(tenant=context_agent)
    assert res_agent.role == "agent"

    # 2. Owner managing billing
    dep_billing = require_permission(Permissions.BILLING_MANAGE)
    res_owner = await dep_billing(tenant=context_owner)
    assert res_owner.role == "owner"


@pytest.mark.asyncio
async def test_state4_wrong_organization_tampering_blocked(db_session, setup_phase5_test_harness):
    """Security State 4: User A attempting to query or mutate Company B resource returns 404/403."""
    context_owner_a = setup_phase5_test_harness["tenant_a"]["context_owner"]
    conv_b = setup_phase5_test_harness["tenant_b"]["conv"]

    # Attempting to fetch Company B conversation using Company A tenant context
    with pytest.raises(HTTPException) as exc_info:
        await TenantRepository.get_one_scoped(
            db=db_session,
            model=Conversation,
            entity_id=conv_b.id,
            tenant=context_owner_a,
        )

    assert exc_info.value.status_code == 404
    assert "not found or access denied" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_state5_correct_organization_plus_permission_succeeds(db_session, setup_phase5_test_harness):
    """Security State 5: Correct organization + correct permission succeeds cleanly."""
    context_owner_a = setup_phase5_test_harness["tenant_a"]["context_owner"]
    conv_a = setup_phase5_test_harness["tenant_a"]["conv"]

    # 1. Verify permission
    dep_conv_read = require_permission(Permissions.CONVERSATIONS_READ)
    valid_context = await dep_conv_read(tenant=context_owner_a)
    assert valid_context.workspace_id == setup_phase5_test_harness["tenant_a"]["ws"].id

    # 2. Execute tenant-scoped query
    fetched_conv = await TenantRepository.get_one_scoped(
        db=db_session,
        model=Conversation,
        entity_id=conv_a.id,
        tenant=valid_context,
    )
    assert fetched_conv is not None
    assert fetched_conv.id == conv_a.id
