from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import (
    get_current_user,
    get_workspace_membership,
    require_role,
)
from apps.api.src.models.core import User, TeamMember
from apps.api.src.schemas.team import (
    TeamMemberInvite,
    RoleUpdateRequest,
    TeamMemberResponse,
    DemoAccountsSeedResponse,
)
from apps.api.src.services import team_service
from apps.api.src.services.cache_service import (
    async_get_json,
    async_set_json,
    async_get_version,
    async_increment_version,
    build_cache_key,
    CacheTTL,
)

router = APIRouter(prefix="/workspaces/{workspace_id}/team", tags=["team"])

@router.get("", response_model=List[TeamMemberResponse])
@router.get("/", response_model=List[TeamMemberResponse])
async def list_team_members(
    workspace_id: str,
    member: TeamMember = Depends(get_workspace_membership),
    db: AsyncSession = Depends(get_db),
):
    version = await async_get_version(workspace_id, "team:members")
    cache_key = build_cache_key(workspace_id, "team:members", version=version)
    
    cached = await async_get_json(cache_key)
    if cached:
        return [TeamMemberResponse(**item) for item in cached]

    members = await team_service.get_team_members(db, workspace_id)
    await async_set_json(cache_key, [item.model_dump() for item in members], ttl_seconds=CacheTTL.NORMAL_LIST)
    return members

@router.post("/invite", response_model=TeamMemberResponse)
async def invite_member(
    workspace_id: str,
    payload: TeamMemberInvite,
    member: TeamMember = Depends(require_role(["owner", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    new_member = await team_service.invite_team_member(
        db, workspace_id=workspace_id, email=payload.email, role=payload.role
    )
    # Invalidate cache version AFTER DB commit in team_service
    await async_increment_version(workspace_id, "team:members")
    return new_member

@router.patch("/{member_id}/role", response_model=TeamMemberResponse)
async def update_role(
    workspace_id: str,
    member_id: str,
    payload: RoleUpdateRequest,
    member: TeamMember = Depends(require_role(["owner"])),
    db: AsyncSession = Depends(get_db),
):
    updated = await team_service.update_team_member_role(
        db, workspace_id=workspace_id, member_id=member_id, new_role=payload.role
    )
    # Invalidate cache version AFTER DB commit in team_service
    await async_increment_version(workspace_id, "team:members")
    return updated

@router.post("/seed-demo", response_model=DemoAccountsSeedResponse)
async def seed_demo_accounts(
    workspace_id: str,
    member: TeamMember = Depends(get_workspace_membership),
    db: AsyncSession = Depends(get_db),
):
    accounts = await team_service.seed_demo_role_accounts(db, workspace_id)
    # Invalidate cache version AFTER DB commit in team_service
    await async_increment_version(workspace_id, "team:members")
    return DemoAccountsSeedResponse(
        message="Successfully generated Owner, Admin, and Agent demo accounts!",
        accounts=accounts,
    )
