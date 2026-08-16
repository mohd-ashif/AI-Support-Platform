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
    AuditLog,
    generate_uuid,
)
from apps.api.src.services.audit_service import log_audit_event
from apps.api.src.dependencies.tenant import get_tenant_context, TenantContext
from apps.api.src.dependencies.rbac import Permissions, require_permission
from apps.api.src.repositories.tenant_repository import TenantRepository


@pytest_asyncio.fixture
async def setup_phase8_hardening_fixtures(db_session):
    """Fixture initializing two isolated multi-role organizations for production hardening verification."""
    # Tenant A
    user_owner_a = User(id=generate_uuid(), email="owner_a@acme.com", name="Owner A")
    user_deactivated_a = User(id=generate_uuid(), email="deactivated_a@acme.com", name="Deactivated A")

    biz_a = Business(id=generate_uuid(), name="Acme Hardened", slug="acme-hardened", owner_user_id=user_owner_a.id)
    ws_a = Workspace(id=generate_uuid(), business_id=biz_a.id, workspace_uuid=generate_uuid(), status="active")

    mem_owner_a = TeamMember(id=generate_uuid(), workspace_id=ws_a.id, user_id=user_owner_a.id, role="owner", status="active")
    mem_deactivated_a = TeamMember(id=generate_uuid(), workspace_id=ws_a.id, user_id=user_deactivated_a.id, role="agent", status="deactivated")

    conv_a = Conversation(id=generate_uuid(), workspace_id=ws_a.id, visitor_id="vis_hardened_a", status="open")

    # Tenant B
    user_owner_b = User(id=generate_uuid(), email="owner_b@globex.com", name="Owner B")
    biz_b = Business(id=generate_uuid(), name="Globex Hardened", slug="globex-hardened", owner_user_id=user_owner_b.id)
    ws_b = Workspace(id=generate_uuid(), business_id=biz_b.id, workspace_uuid=generate_uuid(), status="active")
    mem_owner_b = TeamMember(id=generate_uuid(), workspace_id=ws_b.id, user_id=user_owner_b.id, role="owner", status="active")

    db_session.add_all([
        user_owner_a, user_deactivated_a, biz_a, ws_a, mem_owner_a, mem_deactivated_a, conv_a,
        user_owner_b, biz_b, ws_b, mem_owner_b,
    ])
    await db_session.commit()

    return {
        "tenant_a": {
            "ws": ws_a,
            "biz": biz_a,
            "owner": user_owner_a,
            "deactivated": user_deactivated_a,
            "conv": conv_a,
        },
        "tenant_b": {
            "ws": ws_b,
            "biz": biz_b,
            "owner": user_owner_b,
        },
    }


@pytest.mark.asyncio
async def test_audit_logging_record_created(db_session, setup_phase8_hardening_fixtures):
    """Verify log_audit_event persists structured audit log entries into PostgreSQL."""
    ws_a = setup_phase8_hardening_fixtures["tenant_a"]["ws"]
    owner_a = setup_phase8_hardening_fixtures["tenant_a"]["owner"]

    audit_entry = await log_audit_event(
        db=db_session,
        workspace_id=ws_a.id,
        actor_user_id=owner_a.id,
        action="user.invited",
        resource="team_member",
        resource_id="mem_123",
        metadata={"invited_email": "new_agent@acme.com", "role": "agent"},
    )
    await db_session.commit()

    res = await db_session.execute(select(AuditLog).where(AuditLog.id == audit_entry.id))
    persisted = res.scalars().first()

    assert persisted is not None
    assert persisted.workspace_id == ws_a.id
    assert persisted.actor_user_id == owner_a.id
    assert persisted.action == "user.invited"
    assert persisted.metadata_json["invited_email"] == "new_agent@acme.com"


@pytest.mark.asyncio
async def test_deactivated_member_session_rejected(db_session, setup_phase8_hardening_fixtures):
    """Verify deactivated team members are blocked with HTTP 403 on all tenant context resolutions."""
    ws_a = setup_phase8_hardening_fixtures["tenant_a"]["ws"]
    deactivated_a = setup_phase8_hardening_fixtures["tenant_a"]["deactivated"]

    with pytest.raises(HTTPException) as exc_info:
        await get_tenant_context(
            x_workspace_id=ws_a.id,
            current_user=deactivated_a,
            db=db_session,
        )

    assert exc_info.value.status_code == 403
    assert "deactivated" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_cross_tenant_isolation_matrix(db_session, setup_phase8_hardening_fixtures):
    """Verify User B (Company B) CANNOT access Company A resources under any circumstances."""
    ws_a = setup_phase8_hardening_fixtures["tenant_a"]["ws"]
    owner_b = setup_phase8_hardening_fixtures["tenant_b"]["owner"]
    conv_a = setup_phase8_hardening_fixtures["tenant_a"]["conv"]

    # 1. Attempting to resolve TenantContext for Company A while authenticated as User B ➔ HTTP 403
    with pytest.raises(HTTPException) as exc_info:
        await get_tenant_context(
            x_workspace_id=ws_a.id,
            current_user=owner_b,
            db=db_session,
        )
    assert exc_info.value.status_code == 403

    # 2. Attempting to query Company A resource using User B context ➔ HTTP 404
    tenant_context_b = await get_tenant_context(
        x_workspace_id=setup_phase8_hardening_fixtures["tenant_b"]["ws"].id,
        current_user=owner_b,
        db=db_session,
    )

    with pytest.raises(HTTPException) as exc_info:
        await TenantRepository.get_one_scoped(
            db=db_session,
            model=Conversation,
            entity_id=conv_a.id,
            tenant=tenant_context_b,
        )
    assert exc_info.value.status_code == 404
