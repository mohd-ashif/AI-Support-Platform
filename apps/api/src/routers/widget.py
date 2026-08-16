import re
import logging
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import get_current_user, get_current_workspace_member, require_role
from apps.api.src.models.core import User, TeamMember, Workspace, WidgetConfig, utc_now
from apps.api.src.services.cache_service import (
    async_get_json,
    async_set_json,
    async_get_version,
    async_increment_version,
    build_cache_key,
    CacheTTL,
)

logger = logging.getLogger("widget_router")

router = APIRouter(tags=["widget"])

class ContentCardSchema(BaseModel):
    title: str
    description: str
    icon_name: Optional[str] = "Sparkles"

    @validator("title")
    def validate_title(cls, v):
        if len(v) > 60:
            raise ValueError("Card title cannot exceed 60 characters.")
        return v

    @validator("description")
    def validate_description(cls, v):
        if len(v) > 120:
            raise ValueError("Card description cannot exceed 120 characters.")
        return v

class WidgetConfigUpdate(BaseModel):
    brand_name: Optional[str] = None
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    greeting_message: Optional[str] = None
    content_cards_json: Optional[List[ContentCardSchema]] = None

    @validator("primary_color")
    def validate_hex_color(cls, v):
        if v is not None:
            if not re.match(r"^#[0-9a-fA-F]{6}$", v):
                raise ValueError("primary_color must be a valid 6-digit hex color format (#RRGGBB).")
        return v

    @validator("greeting_message")
    def validate_greeting(cls, v):
        if v is not None and len(v) > 300:
            raise ValueError("greeting_message cannot exceed 300 characters.")
        return v

    @validator("content_cards_json")
    def validate_cards_length(cls, v):
        if v is not None and len(v) > 4:
            raise ValueError("Cannot configure more than 4 content cards.")
        return v

class WidgetConfigResponse(BaseModel):
    id: str
    workspace_id: str
    brand_name: str
    tagline: Optional[str] = None
    logo_url: Optional[str] = None
    primary_color: str
    greeting_message: Optional[str] = None
    content_cards_json: Optional[List[dict]] = None
    updated_at: Optional[str] = None

@router.get("/widget/config", response_model=WidgetConfigResponse)
async def get_widget_config(
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    version = await async_get_version(member.workspace_id, "widget:config")
    cache_key = build_cache_key(member.workspace_id, "widget:config", version=version)
    
    cached = await async_get_json(cache_key)
    if cached:
        return WidgetConfigResponse(**cached)

    res = await db.execute(select(WidgetConfig).where(WidgetConfig.workspace_id == member.workspace_id))
    config = res.scalars().first()
    if not config:
        # Fallback creation if not seeded
        res_ws = await db.execute(select(Workspace).where(Workspace.id == member.workspace_id))
        ws = res_ws.scalars().first()
        config = WidgetConfig(
            workspace_id=member.workspace_id,
            brand_name=ws.name if ws else "SupportAI",
            primary_color="#D4AF37",
            greeting_message="",
            content_cards_json=[],
        )
        db.add(config)
        await db.commit()
        await db.refresh(config)

    resp = WidgetConfigResponse(
        id=config.id,
        workspace_id=config.workspace_id,
        brand_name=config.brand_name or "SupportAI",
        tagline=config.tagline,
        logo_url=config.logo_url,
        primary_color=config.primary_color or "#D4AF37",
        greeting_message=config.greeting_message,
        content_cards_json=config.content_cards_json or [],
        updated_at=config.updated_at.isoformat() if config.updated_at else None,
    )
    await async_set_json(cache_key, resp.model_dump(), ttl_seconds=CacheTTL.WIDGET_CONFIG)
    return resp

@router.patch("/widget/config", response_model=WidgetConfigResponse)
async def update_widget_config(
    payload: WidgetConfigUpdate,
    member: TeamMember = Depends(require_role(["owner", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from apps.api.src.dependencies.rbac import has_role_permission, Permissions
    if not has_role_permission(member.role, Permissions.WIDGET_MANAGE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied. Required permission '{Permissions.WIDGET_MANAGE}' is missing for role '{member.role}'.",
        )

    res = await db.execute(select(WidgetConfig).where(WidgetConfig.workspace_id == member.workspace_id))
    config = res.scalars().first()
    if not config:
        config = WidgetConfig(
            workspace_id=member.workspace_id,
            brand_name="SupportAI",
            primary_color="#D4AF37",
        )
        db.add(config)

    if payload.brand_name is not None:
        config.brand_name = payload.brand_name
    if payload.tagline is not None:
        config.tagline = payload.tagline
    if payload.logo_url is not None:
        config.logo_url = payload.logo_url
    if payload.primary_color is not None:
        config.primary_color = payload.primary_color
    if payload.greeting_message is not None:
        config.greeting_message = payload.greeting_message
    if payload.content_cards_json is not None:
        config.content_cards_json = [c.dict() for c in payload.content_cards_json]

    config.updated_at = utc_now()
    await db.commit()
    await db.refresh(config)

    # Invalidate cache version AFTER DB commit
    await async_increment_version(member.workspace_id, "widget:config")

    resp = WidgetConfigResponse(
        id=config.id,
        workspace_id=config.workspace_id,
        brand_name=config.brand_name or "SupportAI",
        tagline=config.tagline,
        logo_url=config.logo_url,
        primary_color=config.primary_color or "#D4AF37",
        greeting_message=config.greeting_message,
        content_cards_json=config.content_cards_json or [],
        updated_at=config.updated_at.isoformat() if config.updated_at else None,
    )
    return resp

# Public Widget Config Endpoint for Third-Party Websites
@router.get("/public/widget-config", response_model=WidgetConfigResponse)
async def get_public_widget_config(
    workspace_id: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    # Lookup by workspace_uuid or id
    res_ws = await db.execute(
        select(Workspace).where((Workspace.workspace_uuid == workspace_id) | (Workspace.id == workspace_id))
    )
    ws = res_ws.scalars().first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Public workspace not found")

    version = await async_get_version(ws.id, "widget:config")
    cache_key = build_cache_key(ws.id, "widget:config", version=version)
    cached = await async_get_json(cache_key)
    if cached:
        return WidgetConfigResponse(**cached)

    res = await db.execute(select(WidgetConfig).where(WidgetConfig.workspace_id == ws.id))
    config = res.scalars().first()
    if not config:
        resp = WidgetConfigResponse(
            id="cfg_default",
            workspace_id=ws.id,
            brand_name=ws.name,
            primary_color="#D4AF37",
            greeting_message="",
            content_cards_json=[],
        )
        await async_set_json(cache_key, resp.model_dump(), ttl_seconds=CacheTTL.WIDGET_CONFIG)
        return resp

    resp = WidgetConfigResponse(
        id=config.id,
        workspace_id=config.workspace_id,
        brand_name=config.brand_name or ws.name,
        tagline=config.tagline,
        logo_url=config.logo_url,
        primary_color=config.primary_color or "#D4AF37",
        greeting_message=config.greeting_message,
        content_cards_json=config.content_cards_json or [],
        updated_at=config.updated_at.isoformat() if config.updated_at else None,
    )
    await async_set_json(cache_key, resp.model_dump(), ttl_seconds=CacheTTL.WIDGET_CONFIG)
    return resp
