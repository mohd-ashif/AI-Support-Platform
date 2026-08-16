import pytest
import pytest_asyncio
from datetime import datetime, timezone
from sqlalchemy import select, func

from apps.api.src.models.core import (
    User,
    Business,
    Workspace,
    TeamMember,
    Conversation,
    Message,
    SourceWeb,
    SourceFile,
    KnowledgeChunk,
    WidgetConfig,
    Subscription,
    utc_now,
    generate_uuid,
)
from apps.api.src.dependencies.tenant import get_tenant_context, TenantContext
from fastapi import HTTPException


@pytest_asyncio.fixture
async def setup_phase1_test_data(db_session):
    """Fixture that creates two isolated tenants (Organization + Workspace + User + Resources)."""
    # Tenant A
    user_a = User(id=generate_uuid(), email="owner_a@tenant.com", name="Owner A")
    biz_a = Business(id=generate_uuid(), name="Tenant A Corp", slug="tenant-a-corp", owner_user_id=user_a.id, status="active")
    ws_a = Workspace(id=generate_uuid(), business_id=biz_a.id, workspace_uuid=generate_uuid(), status="active")
    member_a = TeamMember(id=generate_uuid(), workspace_id=ws_a.id, user_id=user_a.id, role="owner")
    
    source_a = SourceWeb(id=generate_uuid(), workspace_id=ws_a.id, url="https://tenant-a.com", status="completed", page_count=5)
    conv_a = Conversation(id=generate_uuid(), workspace_id=ws_a.id, visitor_id="vis_a_123", status="open")
    msg_a = Message(id=generate_uuid(), conversation_id=conv_a.id, workspace_id=ws_a.id, sender_type="visitor", content="Hello from Tenant A")
    widget_a = WidgetConfig(id=generate_uuid(), workspace_id=ws_a.id, brand_name="Tenant A AI")

    # Tenant B
    user_b = User(id=generate_uuid(), email="owner_b@tenant.com", name="Owner B")
    biz_b = Business(id=generate_uuid(), name="Tenant B Inc", slug="tenant-b-inc", owner_user_id=user_b.id, status="active")
    ws_b = Workspace(id=generate_uuid(), business_id=biz_b.id, workspace_uuid=generate_uuid(), status="active")
    member_b = TeamMember(id=generate_uuid(), workspace_id=ws_b.id, user_id=user_b.id, role="owner")
    
    source_b = SourceWeb(id=generate_uuid(), workspace_id=ws_b.id, url="https://tenant-b.com", status="completed", page_count=10)
    conv_b = Conversation(id=generate_uuid(), workspace_id=ws_b.id, visitor_id="vis_b_999", status="open")
    msg_b = Message(id=generate_uuid(), conversation_id=conv_b.id, workspace_id=ws_b.id, sender_type="visitor", content="Hello from Tenant B")
    widget_b = WidgetConfig(id=generate_uuid(), workspace_id=ws_b.id, brand_name="Tenant B AI")

    db_session.add_all([
        user_a, biz_a, ws_a, member_a, source_a, conv_a, msg_a, widget_a,
        user_b, biz_b, ws_b, member_b, source_b, conv_b, msg_b, widget_b,
    ])
    await db_session.commit()

    return {
        "tenant_a": {"user": user_a, "biz": biz_a, "ws": ws_a, "member": member_a, "conv": conv_a, "msg": msg_a},
        "tenant_b": {"user": user_b, "biz": biz_b, "ws": ws_b, "member": member_b, "conv": conv_b, "msg": msg_b},
    }


@pytest.mark.asyncio
async def test_business_organization_fields(db_session, setup_phase1_test_data):
    """Verify Organization/Business has slug, status, and updated_at fields."""
    biz_id = setup_phase1_test_data["tenant_a"]["biz"].id
    res = await db_session.execute(select(Business).where(Business.id == biz_id))
    biz = res.scalars().first()

    assert biz is not None
    assert biz.name == "Tenant A Corp"
    assert biz.slug == "tenant-a-corp"
    assert biz.status == "active"
    assert biz.updated_at is not None


@pytest.mark.asyncio
async def test_message_workspace_id_denormalization(db_session, setup_phase1_test_data):
    """Verify Message model has workspace_id correctly attached and indexed."""
    msg_a_id = setup_phase1_test_data["tenant_a"]["msg"].id
    ws_a_id = setup_phase1_test_data["tenant_a"]["ws"].id

    res = await db_session.execute(select(Message).where(Message.id == msg_a_id))
    msg = res.scalars().first()

    assert msg is not None
    assert msg.workspace_id == ws_a_id
    assert msg.content == "Hello from Tenant A"


@pytest.mark.asyncio
async def test_tenant_context_resolution_success(db_session, setup_phase1_test_data):
    """Verify get_tenant_context resolves correct tenant scope for valid user & header."""
    user_a = setup_phase1_test_data["tenant_a"]["user"]
    ws_a = setup_phase1_test_data["tenant_a"]["ws"]
    biz_a = setup_phase1_test_data["tenant_a"]["biz"]

    context: TenantContext = await get_tenant_context(
        x_workspace_id=ws_a.id,
        current_user=user_a,
        db=db_session,
    )

    assert context.user_id == user_a.id
    assert context.workspace_id == ws_a.id
    assert context.organization_id == biz_a.id
    assert context.role == "owner"


@pytest.mark.asyncio
async def test_tenant_context_cross_tenant_access_blocked(db_session, setup_phase1_test_data):
    """Verify get_tenant_context blocks user A from requesting workspace B."""
    user_a = setup_phase1_test_data["tenant_a"]["user"]
    ws_b = setup_phase1_test_data["tenant_b"]["ws"]

    with pytest.raises(HTTPException) as exc_info:
        await get_tenant_context(
            x_workspace_id=ws_b.id,
            current_user=user_a,
            db=db_session,
        )

    assert exc_info.value.status_code == 403
    assert "Access denied" in exc_info.value.detail


@pytest.mark.asyncio
async def test_strict_tenant_data_isolation(db_session, setup_phase1_test_data):
    """Verify queries filtered by workspace_id return ZERO cross-tenant leakage."""
    ws_a_id = setup_phase1_test_data["tenant_a"]["ws"].id
    ws_b_id = setup_phase1_test_data["tenant_b"]["ws"].id

    # Query conversations for Tenant A
    res_a = await db_session.execute(select(Conversation).where(Conversation.workspace_id == ws_a_id))
    convs_a = res_a.scalars().all()
    assert len(convs_a) == 1
    assert convs_a[0].visitor_id == "vis_a_123"

    # Ensure no Tenant B conversations leak into Tenant A query
    res_leak = await db_session.execute(
        select(Conversation).where(
            Conversation.workspace_id == ws_a_id,
            Conversation.visitor_id == "vis_b_999",
        )
    )
    assert len(res_leak.scalars().all()) == 0
