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
    Message,
    SourceWeb,
    SourceFile,
    WidgetConfig,
    APIKey,
    generate_uuid,
)
from apps.api.src.dependencies.tenant import get_tenant_context, TenantContext
from apps.api.src.repositories.tenant_repository import TenantRepository


@pytest_asyncio.fixture
async def setup_multi_tenant_fixtures(db_session):
    """Fixture initializing two completely separate organizations/tenants."""
    # Tenant A
    user_a = User(id=generate_uuid(), email="user_a@tenant-a.com", name="User A")
    biz_a = Business(id=generate_uuid(), name="Company A", slug="company-a", owner_user_id=user_a.id)
    ws_a = Workspace(id=generate_uuid(), business_id=biz_a.id, workspace_uuid=generate_uuid(), status="active")
    member_a = TeamMember(id=generate_uuid(), workspace_id=ws_a.id, user_id=user_a.id, role="owner")
    
    conv_a = Conversation(id=generate_uuid(), workspace_id=ws_a.id, visitor_id="vis_a", status="open")
    msg_a = Message(id=generate_uuid(), conversation_id=conv_a.id, workspace_id=ws_a.id, sender_type="visitor", content="Tenant A Msg")
    source_a = SourceWeb(id=generate_uuid(), workspace_id=ws_a.id, url="https://company-a.com", status="ready")

    # Tenant B
    user_b = User(id=generate_uuid(), email="user_b@tenant-b.com", name="User B")
    biz_b = Business(id=generate_uuid(), name="Company B", slug="company-b", owner_user_id=user_b.id)
    ws_b = Workspace(id=generate_uuid(), business_id=biz_b.id, workspace_uuid=generate_uuid(), status="active")
    member_b = TeamMember(id=generate_uuid(), workspace_id=ws_b.id, user_id=user_b.id, role="owner")
    
    conv_b = Conversation(id=generate_uuid(), workspace_id=ws_b.id, visitor_id="vis_b", status="open")
    msg_b = Message(id=generate_uuid(), conversation_id=conv_b.id, workspace_id=ws_b.id, sender_type="visitor", content="Tenant B Msg")
    source_b = SourceWeb(id=generate_uuid(), workspace_id=ws_b.id, url="https://company-b.com", status="ready")

    db_session.add_all([
        user_a, biz_a, ws_a, member_a, conv_a, msg_a, source_a,
        user_b, biz_b, ws_b, member_b, conv_b, msg_b, source_b,
    ])
    await db_session.commit()

    context_a = TenantContext(user=user_a, member=member_a, workspace=ws_a, business=biz_a)
    context_b = TenantContext(user=user_b, member=member_b, workspace=ws_b, business=biz_b)

    return {
        "tenant_a": {"user": user_a, "ws": ws_a, "context": context_a, "conv": conv_a, "source": source_a},
        "tenant_b": {"user": user_b, "ws": ws_b, "context": context_b, "conv": conv_b, "source": source_b},
    }


@pytest.mark.asyncio
async def test_tenant_a_can_access_tenant_a_resource(db_session, setup_multi_tenant_fixtures):
    """User A -> Company A can access Company A conversation via TenantRepository."""
    context_a = setup_multi_tenant_fixtures["tenant_a"]["context"]
    conv_a = setup_multi_tenant_fixtures["tenant_a"]["conv"]

    fetched_conv = await TenantRepository.get_one_scoped(
        db=db_session,
        model=Conversation,
        entity_id=conv_a.id,
        tenant=context_a,
    )
    assert fetched_conv is not None
    assert fetched_conv.id == conv_a.id
    assert fetched_conv.workspace_id == context_a.workspace_id


@pytest.mark.asyncio
async def test_tenant_a_cannot_access_tenant_b_resource(db_session, setup_multi_tenant_fixtures):
    """User A -> Company B MUST fail with 404/403 when trying to fetch Company B conversation."""
    context_a = setup_multi_tenant_fixtures["tenant_a"]["context"]
    conv_b = setup_multi_tenant_fixtures["tenant_b"]["conv"]

    with pytest.raises(HTTPException) as exc_info:
        await TenantRepository.get_one_scoped(
            db=db_session,
            model=Conversation,
            entity_id=conv_b.id,
            tenant=context_a,
        )

    assert exc_info.value.status_code == 404
    assert "not found or access denied" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_tenant_a_cannot_modify_tenant_b_resource(db_session, setup_multi_tenant_fixtures):
    """Attempting to update Company B resource from Company A context MUST fail."""
    context_a = setup_multi_tenant_fixtures["tenant_a"]["context"]
    conv_b = setup_multi_tenant_fixtures["tenant_b"]["conv"]

    with pytest.raises(HTTPException) as exc_info:
        await TenantRepository.update_scoped(
            db=db_session,
            model=Conversation,
            entity_id=conv_b.id,
            tenant=context_a,
            status="resolved",
        )

    assert exc_info.value.status_code == 404
    
    # Verify Company B conversation status remained unchanged
    res = await db_session.execute(select(Conversation).where(Conversation.id == conv_b.id))
    original = res.scalars().first()
    assert original.status == "open"


@pytest.mark.asyncio
async def test_tenant_a_cannot_delete_tenant_b_resource(db_session, setup_multi_tenant_fixtures):
    """Attempting to delete Company B knowledge source from Company A context MUST fail."""
    context_a = setup_multi_tenant_fixtures["tenant_a"]["context"]
    source_b = setup_multi_tenant_fixtures["tenant_b"]["source"]

    with pytest.raises(HTTPException) as exc_info:
        await TenantRepository.delete_scoped(
            db=db_session,
            model=SourceWeb,
            entity_id=source_b.id,
            tenant=context_a,
        )

    assert exc_info.value.status_code == 404
    
    # Verify Company B source was NOT deleted
    res = await db_session.execute(select(SourceWeb).where(SourceWeb.id == source_b.id))
    assert res.scalars().first() is not None


@pytest.mark.asyncio
async def test_tenant_b_can_access_tenant_b_resource(db_session, setup_multi_tenant_fixtures):
    """User B -> Company B can access Company B resource cleanly."""
    context_b = setup_multi_tenant_fixtures["tenant_b"]["context"]
    conv_b = setup_multi_tenant_fixtures["tenant_b"]["conv"]

    fetched = await TenantRepository.get_one_scoped(
        db=db_session,
        model=Conversation,
        entity_id=conv_b.id,
        tenant=context_b,
    )
    assert fetched is not None
    assert fetched.id == conv_b.id


@pytest.mark.asyncio
async def test_tenant_context_header_tampering_blocked(db_session, setup_multi_tenant_fixtures):
    """Passing header X-Workspace-Id of Company B while authenticated as User A MUST raise 403."""
    user_a = setup_multi_tenant_fixtures["tenant_a"]["user"]
    ws_b = setup_multi_tenant_fixtures["tenant_b"]["ws"]

    with pytest.raises(HTTPException) as exc_info:
        await get_tenant_context(
            x_workspace_id=ws_b.id,
            current_user=user_a,
            db=db_session,
        )

    assert exc_info.value.status_code == 403
    assert "Access denied" in exc_info.value.detail
