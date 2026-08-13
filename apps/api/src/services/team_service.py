from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from apps.api.src.models.core import User, TeamMember, Workspace, Plan, Subscription
from apps.api.src.utils.security import hash_password
from sqlalchemy import func

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
            "avatar_url": user.avatar_url,
            "joined_at": member.joined_at.isoformat() if member.joined_at else member.invited_at.isoformat(),
        })
    return members

async def invite_team_member(
    db: AsyncSession,
    workspace_id: str,
    email: str,
    role: str,
) -> dict:
    norm_email = email.strip().lower()

    # Enforce Seat Quota Limit
    seats_count_res = await db.execute(
        select(func.count(TeamMember.id)).where(TeamMember.workspace_id == workspace_id)
    )
    current_seats = seats_count_res.scalar() or 0

    sub_res = await db.execute(
        select(Subscription).where(Subscription.workspace_id == workspace_id)
    )
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

    result = await db.execute(select(User).where(User.email == norm_email))
    user = result.scalars().first()
    if not user:
        name_part = norm_email.split("@")[0].replace(".", " ").title()
        user = User(
            email=norm_email,
            name=f"{name_part} ({role.title()})",
            password_hash=hash_password("Password123!"),
        )
        db.add(user)
        await db.flush()

    existing_mem = await db.execute(
        select(TeamMember).where(
            TeamMember.workspace_id == workspace_id,
            TeamMember.user_id == user.id,
        )
    )
    if existing_mem.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User is already a member of this workspace",
        )

    member = TeamMember(
        workspace_id=workspace_id,
        user_id=user.id,
        role=role,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)

    return {
        "id": member.id,
        "workspace_id": member.workspace_id,
        "user_id": user.id,
        "name": user.name,
        "email": user.email,
        "role": member.role,
        "avatar_url": user.avatar_url,
        "joined_at": member.invited_at.isoformat(),
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
        "avatar_url": user.avatar_url,
        "joined_at": member.joined_at.isoformat() if member.joined_at else member.invited_at.isoformat(),
    }

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
