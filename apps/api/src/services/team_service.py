import secrets
from datetime import timedelta
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete, update
from fastapi import HTTPException, status

from apps.api.src.models.core import (
    User,
    TeamMember,
    Workspace,
    Business,
    Invite,
    Plan,
    Subscription,
    utc_now,
    generate_uuid,
)
from apps.api.src.utils.security import hash_password

async def get_team_members(db: AsyncSession, workspace_id: str) -> List[dict]:
    result = await db.execute(
        select(TeamMember, User)
        .join(User, TeamMember.user_id == User.id)
        .where(TeamMember.workspace_id == workspace_id)
    )
    rows = result.all()
    members = []
    for member, user in rows:
        members.append({
            "id": member.id,
            "workspace_id": member.workspace_id,
            "user_id": user.id,
            "name": user.name,
            "email": user.email,
            "role": member.role,
            "status": getattr(member, "status", "active") or "active",
            "avatar_url": user.avatar_url,
            "joined_at": member.joined_at.isoformat() if getattr(member, "joined_at", None) else utc_now().isoformat(),
        })
    return members

async def create_invitation(
    db: AsyncSession,
    workspace_id: str,
    invited_by_user_id: str,
    email: str,
    role: str = "agent",
) -> dict:
    norm_email = email.strip().lower()

    # 1. Enforce Seat Quota Limit
    seats_count_res = await db.execute(
        select(func.count(TeamMember.id)).where(TeamMember.workspace_id == workspace_id)
    )
    current_seats = seats_count_res.scalar() or 0

    sub_res = await db.execute(select(Subscription).where(Subscription.workspace_id == workspace_id))
    sub = sub_res.scalars().first()

    ws_res = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = ws_res.scalars().first()

    plan_id = (sub.plan_id if sub else None) or (ws.plan_id if ws else None)
    plan = None
    if plan_id:
        p_res = await db.execute(select(Plan).where((Plan.id == plan_id) | (Plan.name == plan_id)))
        plan = p_res.scalars().first()

    seat_limit = plan.seat_limit if (plan and plan.seat_limit is not None) else 3
    if seat_limit != -1 and current_seats >= seat_limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Seat limit reached ({current_seats}/{seat_limit}). Upgrade your subscription to add more team members.",
        )

    # 2. Check if user is already an active member of this workspace
    res_user = await db.execute(select(User).where(User.email == norm_email))
    existing_user = res_user.scalars().first()

    if existing_user:
        res_mem = await db.execute(
            select(TeamMember).where(
                TeamMember.workspace_id == workspace_id,
                TeamMember.user_id == existing_user.id,
            )
        )
        if res_mem.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User is already a member of this workspace",
            )

    # 3. Create or update pending Invite token
    token = secrets.token_urlsafe(32)
    expires_at = utc_now() + timedelta(days=7)

    res_inv = await db.execute(
        select(Invite).where(
            Invite.workspace_id == workspace_id,
            Invite.email == norm_email,
            Invite.status == "pending",
        )
    )
    existing_invite = res_inv.scalars().first()

    if existing_invite:
        existing_invite.token = token
        existing_invite.expires_at = expires_at
        existing_invite.role = role
        invite = existing_invite
    else:
        invite = Invite(
            workspace_id=workspace_id,
            email=norm_email,
            role=role,
            invited_by_user_id=invited_by_user_id,
            token=token,
            status="pending",
            expires_at=expires_at,
        )
        db.add(invite)

    await db.commit()
    await db.refresh(invite)

    invite_link = f"/accept-invite?token={invite.token}"
    return {
        "id": invite.id,
        "email": invite.email,
        "role": invite.role,
        "token": invite.token,
        "invite_link": invite_link,
        "expires_at": invite.expires_at.isoformat(),
    }

async def invite_team_member(
    db: AsyncSession,
    workspace_id: str,
    email: str,
    role: str,
) -> dict:
    inv = await create_invitation(
        db=db,
        workspace_id=workspace_id,
        invited_by_user_id="system_admin",
        email=email,
        role=role,
    )
    return {
        "id": inv["id"],
        "workspace_id": workspace_id,
        "user_id": "",
        "name": email.split("@")[0].title(),
        "email": email,
        "role": role,
        "avatar_url": None,
        "joined_at": inv["expires_at"],
    }

async def get_invite_details(db: AsyncSession, token: str) -> dict:
    res = await db.execute(select(Invite).where(Invite.token == token))
    invite = res.scalars().first()

    if not invite:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid invitation token",
        )

    if invite.status == "revoked":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has been revoked",
        )

    if invite.status == "accepted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has already been accepted",
        )

    if invite.expires_at < utc_now():
        invite.status = "expired"
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invitation has expired",
        )

    # Fetch workspace & business details
    res_ws = await db.execute(select(Workspace).where(Workspace.id == invite.workspace_id))
    ws = res_ws.scalars().first()

    biz_name = "Organization"
    if ws and ws.business_id:
        res_biz = await db.execute(select(Business).where(Business.id == ws.business_id))
        biz = res_biz.scalars().first()
        if biz:
            biz_name = biz.name

    return {
        "email": invite.email,
        "workspace_id": invite.workspace_id,
        "workspace_name": biz_name,
        "role": invite.role,
        "valid": True,
    }

async def accept_invitation(db: AsyncSession, token: str, current_user: User) -> dict:
    inv_details = await get_invite_details(db, token)

    res_inv = await db.execute(select(Invite).where(Invite.token == token))
    invite = res_inv.scalars().first()

    # Check if existing member in target workspace
    res_mem = await db.execute(
        select(TeamMember).where(
            TeamMember.workspace_id == invite.workspace_id,
            TeamMember.user_id == current_user.id,
        )
    )
    existing_mem = res_mem.scalars().first()

    if existing_mem:
        existing_mem.role = invite.role
        existing_mem.status = "active"
        member = existing_mem
    else:
        member = TeamMember(
            workspace_id=invite.workspace_id,
            user_id=current_user.id,
            role=invite.role,
            status="active",
            joined_at=utc_now(),
        )
        db.add(member)

    invite.status = "accepted"
    await db.commit()
    await db.refresh(member)

    return {
        "id": member.id,
        "workspace_id": member.workspace_id,
        "user_id": current_user.id,
        "name": current_user.name,
        "email": current_user.email,
        "role": member.role,
        "status": member.status,
    }

async def update_team_member_role(
    db: AsyncSession,
    workspace_id: str,
    member_id: str,
    new_role: str,
) -> dict:
    result = await db.execute(
        select(TeamMember, User)
        .join(User, TeamMember.user_id == User.id)
        .where(TeamMember.id == member_id, TeamMember.workspace_id == workspace_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found in this workspace",
        )
    member, user = row
    member.role = new_role
    await db.commit()

    return {
        "id": member.id,
        "workspace_id": member.workspace_id,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": member.role,
        "status": getattr(member, "status", "active") or "active",
        "avatar_url": user.avatar_url,
        "joined_at": member.joined_at.isoformat() if getattr(member, "joined_at", None) else utc_now().isoformat(),
    }

async def toggle_member_status(
    db: AsyncSession,
    workspace_id: str,
    member_id: str,
    new_status: str,
) -> dict:
    result = await db.execute(
        select(TeamMember, User)
        .join(User, TeamMember.user_id == User.id)
        .where(TeamMember.id == member_id, TeamMember.workspace_id == workspace_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found in this workspace",
        )
    member, user = row
    member.status = new_status
    await db.commit()

    return {
        "id": member.id,
        "workspace_id": member.workspace_id,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": member.role,
        "status": member.status,
    }

async def remove_team_member(
    db: AsyncSession,
    workspace_id: str,
    member_id: str,
    requester_user_id: str,
) -> dict:
    result = await db.execute(
        select(TeamMember).where(TeamMember.id == member_id, TeamMember.workspace_id == workspace_id)
    )
    member = result.scalars().first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found in this workspace",
        )

    if member.user_id == requester_user_id and member.role == "owner":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Workspace owner cannot remove themselves from the organization.",
        )

    await db.delete(member)
    await db.commit()
    return {"message": "Team member removed successfully", "id": member_id}

async def seed_demo_role_accounts(db: AsyncSession, workspace_id: str) -> List[dict]:
    demo_specs = [
        {"role": "owner", "prefix": "owner"},
        {"role": "admin", "prefix": "admin"},
        {"role": "agent", "prefix": "agent"},
    ]
    created_accounts = []

    for spec in demo_specs:
        email = f"{spec['prefix']}@acme-support.com"
        name = f"Acme {spec['role'].title()}"
        password = "Password123!"

        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        if not user:
            user = User(
                email=email,
                name=name,
                password_hash=hash_password(password),
            )
            db.add(user)
            await db.flush()

        mem_res = await db.execute(
            select(TeamMember).where(
                TeamMember.workspace_id == workspace_id,
                TeamMember.user_id == user.id,
            )
        )
        mem = mem_res.scalars().first()
        if not mem:
            mem = TeamMember(
                workspace_id=workspace_id,
                user_id=user.id,
                role=spec["role"],
                status="active",
            )
            db.add(mem)
        else:
            mem.role = spec["role"]

        created_accounts.append({
            "email": email,
            "password": password,
            "role": spec["role"],
            "name": name,
        })

    await db.commit()
    return created_accounts

async def auto_seed_global_demo_accounts(db: AsyncSession) -> None:
    """Automatically seeds default demo accounts on server boot for instant testing."""
    demo_users = [
        {"email": "owner@acme-support.com", "name": "Acme Owner", "role": "owner"},
        {"email": "admin@acme-support.com", "name": "Acme Admin", "role": "admin"},
        {"email": "agent@acme-support.com", "name": "Acme Agent", "role": "agent"},
    ]
    for demo in demo_users:
        result = await db.execute(select(User).where(User.email == demo["email"]))
        user = result.scalars().first()
        hashed = hash_password("Password123!")
        if not user:
            user = User(
                email=demo["email"],
                name=demo["name"],
                password_hash=hashed,
            )
            db.add(user)
        else:
            user.password_hash = hashed
    await db.commit()
