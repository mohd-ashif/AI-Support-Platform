from typing import List, Optional
from fastapi import Depends, HTTPException, Header, status, Path
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from apps.api.src.database.session import get_db
from apps.api.src.models.core import User, TeamMember
from apps.api.src.utils.security import decode_access_token
from apps.api.src.services.auth_service import get_user_by_id

security_bearer = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    payload = decode_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired access token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    user_id = payload["sub"]
    user = await get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User associated with token not found",
        )
    return user

async def get_workspace_membership(
    workspace_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMember:
    result = await db.execute(
        select(TeamMember).where(
            TeamMember.workspace_id == workspace_id,
            TeamMember.user_id == current_user.id,
        )
    )
    member = result.scalars().first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not a member of this workspace",
        )
    return member

async def get_current_workspace_member(
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-Id"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TeamMember:
    if not x_workspace_id or x_workspace_id == "undefined" or x_workspace_id == "null":
        result = await db.execute(
            select(TeamMember).where(TeamMember.user_id == current_user.id).order_by(TeamMember.joined_at.asc())
        )
        member = result.scalars().first()
        if not member:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active workspace membership found for this user",
            )
        return member
    return await get_workspace_membership(x_workspace_id, current_user, db)

def require_role(allowed_roles: List[str]):
    async def role_checker(
        member: TeamMember = Depends(get_current_workspace_member),
    ) -> TeamMember:
        if member.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Permission denied. Required role: {', '.join(allowed_roles)}",
            )
        return member
    return role_checker
