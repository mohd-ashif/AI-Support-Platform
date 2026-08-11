import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from fastapi import HTTPException, status

from apps.api.src.models.core import User, RefreshToken, TeamMember, utc_now
from apps.api.src.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    generate_refresh_token_string,
    hash_token,
)
from apps.api.src.config.settings import settings
from apps.api.src.schemas.auth import WorkspaceMemberInfo

logger = logging.getLogger("auth_service")

async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    norm_email = email.strip().lower() if email else ""
    result = await db.execute(select(User).where(User.email == norm_email))
    return result.scalars().first()

async def get_user_by_id(db: AsyncSession, user_id: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalars().first()

async def get_user_workspaces(db: AsyncSession, user_id: str) -> List[WorkspaceMemberInfo]:
    result = await db.execute(select(TeamMember).where(TeamMember.user_id == user_id))
    memberships = result.scalars().all()
    return [WorkspaceMemberInfo(workspace_id=m.workspace_id, role=m.role) for m in memberships]

async def register_user(db: AsyncSession, email: str, password: str, name: str) -> User:
    norm_email = email.strip().lower()
    existing = await get_user_by_email(db, norm_email)
    if existing:
        if existing.password_hash:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="email already registered"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="this email is registered via Google, log in with Google instead"
            )
    
    user = User(
        email=norm_email,
        password_hash=hash_password(password),
        name=name.strip(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

async def authenticate_user(db: AsyncSession, email: str, password: str) -> User:
    norm_email = email.strip().lower() if email else ""
    user = await get_user_by_email(db, norm_email)
    if not user or not user.password_hash or not verify_password(password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    return user

async def create_and_store_refresh_token(
    db: AsyncSession,
    user_id: str,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> str:
    raw_token = generate_refresh_token_string()
    token_hashed = hash_token(raw_token)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    refresh_entity = RefreshToken(
        user_id=user_id,
        token_hash=token_hashed,
        expires_at=expires_at,
        revoked=False,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(refresh_entity)
    await db.commit()
    return raw_token

async def rotate_refresh_token(
    db: AsyncSession,
    raw_token: str,
    user_agent: Optional[str] = None,
    ip_address: Optional[str] = None,
) -> Tuple[User, str]:
    token_hashed = hash_token(raw_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hashed)
    )
    existing_token = result.scalars().first()

    if not existing_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or revoked refresh token",
        )
    
    # REUSE THEFT DETECTION WITH CONCURRENT REQUEST GRACE WINDOW
    if existing_token.revoked:
        if existing_token.replaced_by_id:
            res_next = await db.execute(select(RefreshToken).where(RefreshToken.id == existing_token.replaced_by_id))
            next_token = res_next.scalars().first()
            if next_token and not next_token.revoked and (utc_now() - next_token.created_at).total_seconds() < 30:
                logger.info(f"Grace period: Handled concurrent refresh token request for user_id={existing_token.user_id}")
                user = await get_user_by_id(db, existing_token.user_id)
                new_raw_token = generate_refresh_token_string()
                next_token.token_hash = hash_token(new_raw_token)
                await db.commit()
                return user, new_raw_token

        logger.warning(
            f"SECURITY ALERT: Refresh token reuse detected for user_id={existing_token.user_id}. Revoking all tokens."
        )
        await db.execute(
            update(RefreshToken)
            .where(RefreshToken.user_id == existing_token.user_id)
            .values(revoked=True)
        )
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Security warning: Revoked refresh token reused. All sessions invalidated.",
        )
    
    if existing_token.expires_at < datetime.now(timezone.utc):
        existing_token.revoked = True
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Expired refresh token",
        )
    
    user = await get_user_by_id(db, existing_token.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    
    # Invalidate old token (Rotation)
    existing_token.revoked = True
    
    # Issue new token
    new_raw_token = generate_refresh_token_string()
    new_token_hashed = hash_token(new_raw_token)
    new_expires_at = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    new_refresh = RefreshToken(
        user_id=user.id,
        token_hash=new_token_hashed,
        expires_at=new_expires_at,
        revoked=False,
        user_agent=user_agent,
        ip_address=ip_address,
    )
    db.add(new_refresh)
    await db.flush()
    existing_token.replaced_by_id = new_refresh.id
    await db.commit()

    return user, new_raw_token

async def revoke_refresh_token(db: AsyncSession, raw_token: str) -> None:
    token_hashed = hash_token(raw_token)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hashed)
    )
    token_record = result.scalars().first()
    if token_record:
        token_record.revoked = True
        await db.commit()

async def handle_google_user_info(
    db: AsyncSession,
    email: str,
    name: str,
    google_id: str,
    avatar_url: Optional[str] = None,
) -> User:
    norm_email = email.strip().lower()
    user = await get_user_by_email(db, norm_email)
    if user:
        if not user.google_id:
            user.google_id = google_id
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        await db.commit()
        await db.refresh(user)
        return user

    user = User(
        email=norm_email,
        name=name or norm_email.split("@")[0],
        google_id=google_id,
        avatar_url=avatar_url,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
