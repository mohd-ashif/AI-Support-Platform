import pytest
import pytest_asyncio
from datetime import timedelta
from fastapi import HTTPException
from sqlalchemy import select

from apps.api.src.models.core import (
    User,
    Business,
    Workspace,
    TeamMember,
    Invite,
    utc_now,
    generate_uuid,
)
from apps.api.src.services.team_service import (
    create_invitation,
    get_invite_details,
    accept_invitation,
    toggle_member_status,
    remove_team_member,
    get_team_members,
)


@pytest_asyncio.fixture
async def setup_phase3_membership_data(db_session):
    """Fixture initializing an organization with owner and secondary user."""
    owner_user = User(id=generate_uuid(), email="owner@org.com", name="Org Owner")
    invitee_user = User(id=generate_uuid(), email="invitee@org.com", name="Invitee User")

    biz = Business(id=generate_uuid(), name="Acme SaaS", slug="acme-saas", owner_user_id=owner_user.id)
    ws = Workspace(id=generate_uuid(), business_id=biz.id, workspace_uuid=generate_uuid(), status="active")
    owner_member = TeamMember(id=generate_uuid(), workspace_id=ws.id, user_id=owner_user.id, role="owner", status="active")

    db_session.add_all([owner_user, invitee_user, biz, ws, owner_member])
    await db_session.commit()

    return {
        "owner": owner_user,
        "invitee": invitee_user,
        "biz": biz,
        "ws": ws,
        "owner_member": owner_member,
    }


@pytest.mark.asyncio
async def test_full_invitation_lifecycle(db_session, setup_phase3_membership_data):
    """Verify full invitation flow: invite -> token -> details -> accept -> active membership."""
    ws = setup_phase3_membership_data["ws"]
    owner = setup_phase3_membership_data["owner"]
    invitee = setup_phase3_membership_data["invitee"]

    # 1. Create invitation
    inv_data = await create_invitation(
        db=db_session,
        workspace_id=ws.id,
        invited_by_user_id=owner.id,
        email=invitee.email,
        role="agent",
    )
    token = inv_data["token"]
    assert token is not None

    # 2. Inspect invitation details
    details = await get_invite_details(db_session, token)
    assert details["valid"] is True
    assert details["email"] == invitee.email
    assert details["role"] == "agent"

    # 3. Accept invitation
    accepted = await accept_invitation(db_session, token, invitee)
    assert accepted["workspace_id"] == ws.id
    assert accepted["user_id"] == invitee.id
    assert accepted["status"] == "active"

    # 4. Verify member is listed in team
    members = await get_team_members(db_session, ws.id)
    emails = [m["email"] for m in members]
    assert invitee.email in emails


@pytest.mark.asyncio
async def test_invitation_expired_token(db_session, setup_phase3_membership_data):
    """Verify expired invitation tokens raise HTTP 400."""
    ws = setup_phase3_membership_data["ws"]
    owner = setup_phase3_membership_data["owner"]

    expired_invite = Invite(
        id=generate_uuid(),
        workspace_id=ws.id,
        email="expired@test.com",
        role="agent",
        invited_by_user_id=owner.id,
        token="exp_token_123",
        status="pending",
        expires_at=utc_now() - timedelta(days=1),
    )
    db_session.add(expired_invite)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await get_invite_details(db_session, "exp_token_123")

    assert exc_info.value.status_code == 400
    assert "expired" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_invitation_revoked_token(db_session, setup_phase3_membership_data):
    """Verify revoked invitation tokens raise HTTP 400."""
    ws = setup_phase3_membership_data["ws"]
    owner = setup_phase3_membership_data["owner"]

    revoked_invite = Invite(
        id=generate_uuid(),
        workspace_id=ws.id,
        email="revoked@test.com",
        role="agent",
        invited_by_user_id=owner.id,
        token="revoked_token_123",
        status="revoked",
        expires_at=utc_now() + timedelta(days=7),
    )
    db_session.add(revoked_invite)
    await db_session.commit()

    with pytest.raises(HTTPException) as exc_info:
        await get_invite_details(db_session, "revoked_token_123")

    assert exc_info.value.status_code == 400
    assert "revoked" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_invitation_invalid_token(db_session):
    """Verify invalid tokens raise HTTP 404."""
    with pytest.raises(HTTPException) as exc_info:
        await get_invite_details(db_session, "non_existent_token")

    assert exc_info.value.status_code == 404
    assert "invalid" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_invite_existing_member_blocked(db_session, setup_phase3_membership_data):
    """Verify inviting an existing workspace member raises HTTP 400."""
    ws = setup_phase3_membership_data["ws"]
    owner = setup_phase3_membership_data["owner"]

    with pytest.raises(HTTPException) as exc_info:
        await create_invitation(
            db=db_session,
            workspace_id=ws.id,
            invited_by_user_id=owner.id,
            email=owner.email,
            role="agent",
        )

    assert exc_info.value.status_code == 400
    assert "already a member" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_member_deactivation_and_removal(db_session, setup_phase3_membership_data):
    """Verify toggling member status and member removal."""
    ws = setup_phase3_membership_data["ws"]
    owner = setup_phase3_membership_data["owner"]
    invitee = setup_phase3_membership_data["invitee"]

    # Add member
    agent_mem = TeamMember(id=generate_uuid(), workspace_id=ws.id, user_id=invitee.id, role="agent", status="active")
    db_session.add(agent_mem)
    await db_session.commit()

    # 1. Deactivate member
    updated = await toggle_member_status(db_session, ws.id, agent_mem.id, "deactivated")
    assert updated["status"] == "deactivated"

    # 2. Remove member
    removed = await remove_team_member(db_session, ws.id, agent_mem.id, owner.id)
    assert removed["status"] == "ok"

    # 3. Owner self-removal blocked
    owner_mem = setup_phase3_membership_data["owner_member"]
    with pytest.raises(HTTPException) as exc_info:
        await remove_team_member(db_session, ws.id, owner_mem.id, owner.id)

    assert exc_info.value.status_code == 400
    assert "cannot remove" in exc_info.value.detail.lower()


@pytest.mark.asyncio
async def test_multi_organization_membership(db_session, setup_phase3_membership_data):
    """Verify single user can belong to multiple organizations seamlessly."""
    user = setup_phase3_membership_data["invitee"]

    # Org 1
    ws1 = setup_phase3_membership_data["ws"]
    mem1 = TeamMember(id=generate_uuid(), workspace_id=ws1.id, user_id=user.id, role="agent", status="active")

    # Org 2
    biz2 = Business(id=generate_uuid(), name="Second Org", slug="second-org", owner_user_id=user.id)
    ws2 = Workspace(id=generate_uuid(), business_id=biz2.id, workspace_uuid=generate_uuid(), status="active")
    mem2 = TeamMember(id=generate_uuid(), workspace_id=ws2.id, user_id=user.id, role="owner", status="active")

    db_session.add_all([mem1, biz2, ws2, mem2])
    await db_session.commit()

    res = await db_session.execute(select(TeamMember).where(TeamMember.user_id == user.id))
    user_memberships = res.scalars().all()

    assert len(user_memberships) == 2
    ws_ids = [m.workspace_id for m in user_memberships]
    assert ws1.id in ws_ids
    assert ws2.id in ws_ids
