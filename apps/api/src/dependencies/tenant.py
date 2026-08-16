from typing import Optional
from fastapi import Depends, HTTPException, Header, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from apps.api.src.database.session import get_db
from apps.api.src.models.core import User, TeamMember, Workspace, Business
from apps.api.src.dependencies.auth import get_current_user


class TenantContext(BaseModel):
    """
    Unified immutable Tenant Context representation.
    Ensures security scoping is derived strictly from authenticated user identity
    and verified database workspace memberships.
    """
    model_config = ConfigDict(arbitrary_types_allowed=True)

    user: User
    member: TeamMember
    workspace: Workspace
    business: Business

    @property
    def user_id(self) -> str:
        return self.user.id

    @property
    def workspace_id(self) -> str:
        return self.workspace.id

    @property
    def organization_id(self) -> str:
        return self.business.id

    @property
    def role(self) -> str:
        return self.member.role


async def get_tenant_context(
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-Id"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TenantContext:
    """
    FastAPI dependency that resolves and verifies tenant context.
    Prevents arbitrary organization/workspace ID parameters from request bodies/headers
    from bypassing tenant boundary checks.
    """
    # 1. Resolve workspace membership
    if not x_workspace_id or x_workspace_id in ("undefined", "null", ""):
        res_member = await db.execute(
            select(TeamMember)
            .where(TeamMember.user_id == current_user.id)
            .order_by(TeamMember.joined_at.asc())
        )
        member = res_member.scalars().first()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active workspace membership found for authenticated user",
            )
    else:
        res_member = await db.execute(
            select(TeamMember).where(
                TeamMember.workspace_id == x_workspace_id,
                TeamMember.user_id == current_user.id,
            )
        )
        member = res_member.scalars().first()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied. Authenticated user is not a member of requested workspace.",
            )

    if getattr(member, "status", "active") == "deactivated":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Your organization membership has been deactivated.",
        )

    # 2. Fetch associated Workspace
    res_ws = await db.execute(select(Workspace).where(Workspace.id == member.workspace_id))
    workspace = res_ws.scalars().first()
    if not workspace:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workspace entity not found",
        )

    # 3. Fetch associated Organization (Business)
    res_biz = await db.execute(select(Business).where(Business.id == workspace.business_id))
    business = res_biz.scalars().first()
    if not business:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization business entity not found for workspace",
        )

    return TenantContext(
        user=current_user,
        member=member,
        workspace=workspace,
        business=business,
    )
