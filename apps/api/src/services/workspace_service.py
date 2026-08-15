import urllib.parse
from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from apps.api.src.models.core import (
    Business,
    Workspace,
    TeamMember,
    WidgetConfig,
    Plan,
    Subscription,
    User,
    generate_uuid,
    utc_now,
)

def normalize_and_validate_url(url: str) -> str:
    if not url:
        raise HTTPException(status_code=422, detail="Website URL is required")
    url = url.strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        url = "https://" + url
    parsed = urllib.parse.urlparse(url)
    if not parsed.netloc or "." not in parsed.netloc:
        raise HTTPException(status_code=422, detail="Invalid website URL format")
    return url

async def create_workspace_step1(
    db: AsyncSession,
    user_id: str,
    business_name: str,
    website_url: str,
    industry: str,
    logo_url: Optional[str] = None,
) -> dict:
    # Ensure missing schema columns exist on Neon DB
    try:
        await db.execute(text("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS integration_viewed BOOLEAN DEFAULT FALSE;"))
        await db.execute(text("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS widget_tested BOOLEAN DEFAULT FALSE;"))
        await db.commit()
    except Exception:
        pass

    normalized_url = normalize_and_validate_url(website_url)

    # 1. Idempotency: return existing "onboarding" workspace if user is owner
    stmt = (
        select(Workspace)
        .join(TeamMember, TeamMember.workspace_id == Workspace.id)
        .where(
            TeamMember.user_id == user_id,
            TeamMember.role == "owner",
            Workspace.status == "onboarding",
        )
    )
    res = await db.execute(stmt)
    existing = res.scalars().first()
    if existing:
        user_workspaces = await get_user_workspaces(db, user_id)
        target = next((w for w in user_workspaces if w["id"] == existing.id), None)
        if target:
            return target

    # 2. Abuse guard: max 3 workspaces for owner
    stmt_count = select(TeamMember).where(TeamMember.user_id == user_id, TeamMember.role == "owner")
    res_count = await db.execute(stmt_count)
    owned_count = len(res_count.scalars().all())
    if owned_count >= 3:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Maximum limit of 3 workspaces reached on Free/Starter path.",
        )

    # 3. Single DB transaction insert
    business = Business(
        name=business_name.strip(),
        website_url=normalized_url,
        industry=industry.strip(),
        logo_url=logo_url,
        owner_user_id=user_id,
    )
    db.add(business)
    await db.flush()

    workspace = Workspace(
        business_id=business.id,
        workspace_uuid=generate_uuid(),
        status="onboarding",
    )

    db.add(workspace)
    await db.flush()

    team_member = TeamMember(
        workspace_id=workspace.id,
        user_id=user_id,
        role="owner",
        joined_at=utc_now(),
    )
    db.add(team_member)

    widget_config = WidgetConfig(
        workspace_id=workspace.id,
        brand_name=business_name.strip(),
        greeting_message="Hello! How can our AI assistant help you today?",
        primary_color="#D4AF37",
    )
    db.add(widget_config)

    # 5. Automatically create Web Knowledge Source for company website URL
    from apps.api.src.models.core import SourceWeb, KnowledgeChunk
    source_web = SourceWeb(
        workspace_id=workspace.id,
        url=normalized_url,
        status="ready",
        page_count=1,
    )
    db.add(source_web)
    await db.flush()

    # 6. Automatically populate initial Knowledge Chunk for instant AI RAG answers
    initial_chunk = KnowledgeChunk(
        workspace_id=workspace.id,
        source_id=source_web.id,
        content=f"Company Name: {business_name.strip()}\nWebsite URL: {normalized_url}\nIndustry: {industry.strip()}\n\nAbout {business_name.strip()}: We provide enterprise products and customer support services tailored for {industry.strip()}.",
        token_count=50,
    )
    db.add(initial_chunk)

    await db.commit()
    await db.refresh(workspace)
    await db.refresh(business)
    await db.refresh(widget_config)

    return {
        "id": workspace.id,
        "business_id": workspace.business_id,
        "workspace_uuid": workspace.workspace_uuid,
        "role": team_member.role,
        "status": workspace.status,
        "business": {
            "id": business.id,
            "name": business.name,
            "website_url": business.website_url,
            "industry": business.industry,
            "logo_url": business.logo_url,
            "created_at": business.created_at.isoformat() if business.created_at else "",
        },
        "widget_config": {
            "id": widget_config.id,
            "brand_name": widget_config.brand_name,
            "tagline": widget_config.tagline,
            "logo_url": widget_config.logo_url,
            "primary_color": widget_config.primary_color,
            "greeting_message": widget_config.greeting_message,
        },
        "created_at": workspace.created_at.isoformat() if workspace.created_at else "",
    }

async def create_workspace_setup(
    db: AsyncSession,
    user_id: str,
    name: str,
    website_url: Optional[str] = None,
    industry: Optional[str] = None,
    brand_name: Optional[str] = None,
    primary_color: Optional[str] = "#D4AF37",
    greeting_message: Optional[str] = "Hello! How can we help you today?",
    plan_name: Optional[str] = "Free",
) -> Workspace:
    # 1. Create Business
    business = Business(
        name=name,
        website_url=website_url,
        industry=industry,
        owner_user_id=user_id,
    )
    db.add(business)
    await db.flush()

    # 2. Get or create Plan
    plan_result = await db.execute(select(Plan).where(Plan.name == plan_name))
    plan = plan_result.scalars().first()
    if not plan:
        plan = Plan(
            name=plan_name or "Free",
            price_monthly=0.0 if plan_name == "Free" else 49.0,
            price_annual=0.0 if plan_name == "Free" else 490.0,
            message_limit=1000 if plan_name == "Free" else 10000,
            seat_limit=3 if plan_name == "Free" else 10,
        )
        db.add(plan)
        await db.flush()

    # 3. Create Workspace
    workspace = Workspace(
        business_id=business.id,
        plan_id=plan.id,
        status="active",
    )
    db.add(workspace)
    await db.flush()

    # 4. Create Owner TeamMember link
    team_member = TeamMember(
        workspace_id=workspace.id,
        user_id=user_id,
        role="owner",
    )
    db.add(team_member)

    # 5. Create Subscription
    subscription = Subscription(
        workspace_id=workspace.id,
        plan_id=plan.id,
        status="active",
    )
    db.add(subscription)

    # 6. Create WidgetConfig
    widget_config = WidgetConfig(
        workspace_id=workspace.id,
        brand_name=brand_name or name,
        primary_color=primary_color or "#D4AF37",
        greeting_message=greeting_message or "Hello! How can we help you today?",
    )
    db.add(widget_config)

    await db.commit()
    await db.refresh(workspace)
    return workspace

async def get_user_workspaces(db: AsyncSession, user_id: str) -> List[dict]:
    try:
        await db.execute(text("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS integration_viewed BOOLEAN DEFAULT FALSE;"))
        await db.execute(text("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS widget_tested BOOLEAN DEFAULT FALSE;"))
        await db.commit()
    except Exception:
        pass

    result = await db.execute(
        select(TeamMember, Workspace, Business, WidgetConfig)
        .join(Workspace, TeamMember.workspace_id == Workspace.id)
        .outerjoin(Business, Workspace.business_id == Business.id)
        .outerjoin(WidgetConfig, WidgetConfig.workspace_id == Workspace.id)
        .where(TeamMember.user_id == user_id)
    )
    
    rows = result.all()
    workspaces_data = []
    for member, ws, biz, widget in rows:
        # Self-healing: if subscription is active/trialing but workspace status is onboarding, update workspace status
        sub_res = await db.execute(select(Subscription).where(Subscription.workspace_id == ws.id))
        sub = sub_res.scalars().first()
        if sub and sub.status in ["active", "trialing"] and ws.status == "onboarding":
            ws.status = sub.status
            await db.commit()

        biz_data = {
            "id": biz.id,
            "name": biz.name,
            "website_url": biz.website_url,
            "industry": biz.industry,
            "logo_url": biz.logo_url,
            "created_at": biz.created_at.isoformat() if (biz and biz.created_at) else "",
        } if biz else {
            "id": ws.business_id or ws.id,
            "name": (widget.brand_name if (widget and widget.brand_name) else "SupportAI Workspace"),
            "website_url": "",
            "industry": "",
            "logo_url": None,
            "created_at": ws.created_at.isoformat() if ws.created_at else "",
        }

        workspaces_data.append({
            "id": ws.id,
            "business_id": ws.business_id or ws.id,
            "workspace_uuid": ws.workspace_uuid,
            "role": member.role,
            "status": ws.status,
            "business": biz_data,
            "widget_config": {
                "id": widget.id,
                "brand_name": widget.brand_name,
                "tagline": widget.tagline,
                "logo_url": widget.logo_url,
                "primary_color": widget.primary_color,
                "greeting_message": widget.greeting_message,
            } if widget else None,
            "created_at": ws.created_at.isoformat() if ws.created_at else "",
        })
    return workspaces_data
