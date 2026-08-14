import hashlib
import hmac
import secrets
from datetime import timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import (
    get_current_user,
    get_workspace_membership,
    get_current_workspace_member,
    require_role,
)
from apps.api.src.models.core import (
    User,
    TeamMember,
    Workspace,
    Invite,
    APIKey,
    Webhook,
    Conversation,
    SourceWeb,
    SourceFile,
    Subscription,
    Plan,
    utc_now,
    generate_uuid,
)
import logging

logger = logging.getLogger("settings")

router = APIRouter(prefix="/settings", tags=["settings"])

# --- STEP 1 & 2: TEAM INVITES & RBAC ---
class InviteRequest(BaseModel):
    email: str
    role: str = "agent"

class InviteResponse(BaseModel):
    id: str
    email: str
    role: str
    invite_link: str
    expires_at: str

class InviteDetailsResponse(BaseModel):
    email: str
    workspace_name: str
    role: str
    valid: bool

class RoleUpdateRequest(BaseModel):
    role: str

class TeamMemberItemResponse(BaseModel):
    id: str
    workspace_id: str
    user_id: str
    name: str
    email: str
    role: str
    joined_at: str

@router.get("/team", response_model=List[TeamMemberItemResponse])
async def list_team_members(
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(TeamMember, User)
        .join(User, TeamMember.user_id == User.id)
        .where(TeamMember.workspace_id == member.workspace_id)
    )
    rows = res.all()
    out = []
    for tm, u in rows:
        out.append(
            TeamMemberItemResponse(
                id=tm.id,
                workspace_id=tm.workspace_id,
                user_id=tm.user_id,
                name=u.name,
                email=u.email,
                role=tm.role,
                joined_at=tm.joined_at.isoformat() if tm.joined_at else utc_now().isoformat(),
            )
        )
    return out


@router.post("/team/invite", response_model=InviteResponse)
async def create_team_invite(
    payload: InviteRequest,
    member: TeamMember = Depends(require_role(["owner", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    email_clean = payload.email.lower().strip()

    # Check if already active member
    res_user = await db.execute(select(User).where(User.email == email_clean))
    existing_user = res_user.scalars().first()
    if existing_user:
        res_mem = await db.execute(
            select(TeamMember).where(
                TeamMember.workspace_id == member.workspace_id,
                TeamMember.user_id == existing_user.id,
            )
        )
        if res_mem.scalars().first():
            raise HTTPException(status_code=400, detail="User is already an active member of this workspace.")

    token = secrets.token_urlsafe(32)
    expires_at = utc_now() + timedelta(days=7)

    invite = Invite(
        workspace_id=member.workspace_id,
        email=email_clean,
        role=payload.role,
        invited_by_user_id=member.user_id,
        token=token,
        status="pending",
        expires_at=expires_at,
    )
    db.add(invite)
    await db.commit()
    await db.refresh(invite)

    invite_link = f"http://localhost:3000/invite/{token}"
    try:
        from apps.api.src.services.email_service import send_team_invitation_email
        await send_team_invitation_email(
            to_email=invite.email,
            role=invite.role,
            invite_link=invite_link,
            workspace_name="SupportAI Workspace",
        )
    except Exception as e:
        logger.warning(f"Failed to dispatch invitation email: {e}")

    return InviteResponse(
        id=invite.id,
        email=invite.email,
        role=invite.role,
        invite_link=invite_link,
        expires_at=invite.expires_at.isoformat(),
    )

@router.get("/invites/{token}", response_model=InviteDetailsResponse)
async def get_invite_details(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    from apps.api.src.models.core import Business
    res_inv = await db.execute(select(Invite).where(Invite.token == token))
    invite = res_inv.scalars().first()
    if not invite:
        return InviteDetailsResponse(email="", workspace_name="", role="", valid=False, status="invalid")

    res_ws = await db.execute(select(Workspace).where(Workspace.id == invite.workspace_id))
    ws = res_ws.scalars().first()

    ws_name = "SupportAI Workspace"
    if ws:
        res_biz = await db.execute(select(Business).where(Business.id == ws.business_id))
        biz = res_biz.scalars().first()
        if biz and biz.name and biz.name != ws.id:
            ws_name = biz.name
        else:
            res_widget = await db.execute(select(WidgetConfig).where(WidgetConfig.workspace_id == ws.id))
            widget = res_widget.scalars().first()
            if widget and widget.brand_name and widget.brand_name != ws.id:
                ws_name = widget.brand_name
            else:
                ws_name = f"SupportAI Workspace ({ws.id[:8]})"

    if invite.status == "accepted":
        return InviteDetailsResponse(
            email=invite.email,
            workspace_name=ws_name,
            role=invite.role,
            valid=True,
            status="accepted",
        )

    is_valid = (invite.status == "pending") and (invite.expires_at > utc_now())
    return InviteDetailsResponse(
        email=invite.email,
        workspace_name=ws_name,
        role=invite.role,
        valid=is_valid,
        status=invite.status,
    )

@router.post("/invites/{token}/accept")
async def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    res_inv = await db.execute(select(Invite).where(Invite.token == token))
    invite = res_inv.scalars().first()
    if not invite or invite.status != "pending" or invite.expires_at <= utc_now():
        raise HTTPException(status_code=400, detail="Invalid or expired invitation token.")

    if current_user.email.lower() != invite.email.lower():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Invite email ({invite.email}) does not match your logged-in account ({current_user.email}).",
        )

    res_mem = await db.execute(
        select(TeamMember).where(
            TeamMember.workspace_id == invite.workspace_id,
            TeamMember.user_id == current_user.id,
        )
    )
    mem = res_mem.scalars().first()
    if not mem:
        mem = TeamMember(
            workspace_id=invite.workspace_id,
            user_id=current_user.id,
            role=invite.role,
            joined_at=utc_now(),
        )
        db.add(mem)
    else:
        mem.role = invite.role
        if not mem.joined_at:
            mem.joined_at = utc_now()

    invite.status = "accepted"
    await db.commit()

    return {"status": "ok", "workspace_id": invite.workspace_id}

@router.patch("/team/{member_id}/role")
async def update_member_role(
    member_id: str,
    payload: RoleUpdateRequest,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res_target = await db.execute(
        select(TeamMember).where(
            TeamMember.id == member_id,
            TeamMember.workspace_id == member.workspace_id,
        )
    )
    target = res_target.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Team member not found.")

    # Admin restrictions
    if member.role == "admin" and (target.role == "owner" or payload.role == "owner"):
        raise HTTPException(status_code=403, detail="Admins cannot create or modify owners.")

    # Prevent demoting last owner
    if target.role == "owner" and payload.role != "owner":
        owners_res = await db.execute(
            select(func.count(TeamMember.id)).where(
                TeamMember.workspace_id == member.workspace_id,
                TeamMember.role == "owner",
            )
        )
        owner_cnt = owners_res.scalar() or 0
        if owner_cnt <= 1:
            raise HTTPException(status_code=400, detail="A workspace must have at least one owner.")

    target.role = payload.role
    await db.commit()
    return {"status": "ok", "role": target.role}

@router.delete("/team/{member_id}")
async def remove_team_member(
    member_id: str,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res_target = await db.execute(
        select(TeamMember).where(
            TeamMember.id == member_id,
            TeamMember.workspace_id == member.workspace_id,
        )
    )
    target = res_target.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="Team member not found.")

    if target.role == "owner":
        owners_res = await db.execute(
            select(func.count(TeamMember.id)).where(
                TeamMember.workspace_id == member.workspace_id,
                TeamMember.role == "owner",
            )
        )
        owner_cnt = owners_res.scalar() or 0
        if owner_cnt <= 1:
            raise HTTPException(status_code=400, detail="A workspace must have at least one owner.")

    await db.delete(target)
    await db.commit()
    return {"status": "ok"}

# --- STEP 3: BILLING PORTAL ---
@router.post("/billing/portal")
async def create_billing_portal_session(
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res_sub = await db.execute(
        select(Subscription).where(Subscription.workspace_id == member.workspace_id)
    )
    sub = res_sub.scalars().first()

    customer_id = sub.stripe_customer_id if sub else None
    if not customer_id:
        # Create Stripe customer on the fly if missing (Free trial upgrade)
        res_user = await db.execute(select(User).where(User.id == member.user_id))
        u = res_user.scalars().first()
        customer_id = f"cus_created_{generate_uuid()[:8]}"
        if sub:
            sub.stripe_customer_id = customer_id
        else:
            sub = Subscription(
                workspace_id=member.workspace_id,
                plan_id="plan_starter",
                stripe_customer_id=customer_id,
                status="trialing",
            )
            db.add(sub)
        await db.commit()

    portal_url = f"http://localhost:3000/dashboard/billing?portal_session=ps_mock_{generate_uuid()[:8]}"
    return {"url": portal_url}

# --- STEP 4: API KEYS (Hash storage + Prefix lookup) ---
class APIKeyCreateRequest(BaseModel):
    label: str

class APIKeyCreateResponse(BaseModel):
    id: str
    label: str
    key_prefix: str
    raw_key: str

class APIKeyItem(BaseModel):
    id: str
    label: str
    key_prefix: str
    created_at: str
    revoked: bool

@router.post("/api-keys", response_model=APIKeyCreateResponse)
async def create_api_key(
    payload: APIKeyCreateRequest,
    member: TeamMember = Depends(require_role(["owner", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from apps.api.src.services.cache_service import async_increment_version

    raw_secret = secrets.token_urlsafe(32)
    key_prefix = f"sk_test_{raw_secret[:8]}"
    raw_key = f"{key_prefix}_{raw_secret}"

    key_hash = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()

    key_row = APIKey(
        workspace_id=member.workspace_id,
        key_prefix=key_prefix,
        key_hash=key_hash,
        label=payload.label,
    )
    db.add(key_row)
    await db.commit()

    # Invalidate cache version AFTER DB commit
    await async_increment_version(member.workspace_id, "api:keys")

    return APIKeyCreateResponse(
        id=key_row.id,
        label=key_row.label,
        key_prefix=key_prefix,
        raw_key=raw_key,
    )

@router.get("/api-keys", response_model=List[APIKeyItem])
async def list_api_keys(
    member: TeamMember = Depends(require_role(["owner", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from apps.api.src.services.cache_service import (
        async_get_json,
        async_set_json,
        async_get_version,
        build_cache_key,
        CacheTTL,
    )

    version = await async_get_version(member.workspace_id, "api:keys")
    cache_key = build_cache_key(member.workspace_id, "api:keys", version=version)

    cached = await async_get_json(cache_key)
    if cached:
        return [APIKeyItem(**item) for item in cached]

    res = await db.execute(
        select(APIKey).where(APIKey.workspace_id == member.workspace_id)
    )
    keys = res.scalars().all()
    out = [
        APIKeyItem(
            id=k.id,
            label=k.label,
            key_prefix=f"{k.key_prefix}••••••••",
            created_at=k.created_at.isoformat(),
            revoked=k.revoked_at is not None,
        )
        for k in keys
    ]
    await async_set_json(cache_key, [item.model_dump() for item in out], ttl_seconds=CacheTTL.NORMAL_LIST)
    return out

@router.delete("/api-keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    member: TeamMember = Depends(require_role(["owner", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    from apps.api.src.services.cache_service import async_increment_version

    res = await db.execute(
        select(APIKey).where(
            APIKey.id == key_id,
            APIKey.workspace_id == member.workspace_id,
        )
    )
    key_row = res.scalars().first()
    if not key_row:
        raise HTTPException(status_code=404, detail="API key not found.")

    key_row.revoked_at = utc_now()
    await db.commit()

    # Invalidate cache version AFTER DB commit
    await async_increment_version(member.workspace_id, "api:keys")

    return {"status": "ok"}

# --- STEP 5: WEBHOOKS (SECOND SSRF Surface) ---
class WebhookCreateRequest(BaseModel):
    url: str
    events: List[str]

class WebhookResponse(BaseModel):
    id: str
    url: str
    events: List[str]
    secret: str

@router.post("/webhooks", response_model=WebhookResponse)
async def create_webhook(
    payload: WebhookCreateRequest,
    member: TeamMember = Depends(require_role(["owner", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    # SECURITY CRITICAL: Reusing shared validate_url_ssrf from Phase 4
    validated_url = validate_url_ssrf(payload.url)

    secret = f"whsec_{secrets.token_hex(24)}"
    wh = Webhook(
        workspace_id=member.workspace_id,
        url=validated_url,
        events_json={"events": payload.events},
        secret=secret,
    )
    db.add(wh)
    await db.commit()

    return WebhookResponse(
        id=wh.id,
        url=wh.url,
        events=payload.events,
        secret=secret,
    )

@router.post("/webhooks/{webhook_id}/test")
async def test_webhook_dispatch(
    webhook_id: str,
    member: TeamMember = Depends(require_role(["owner", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Webhook).where(
            Webhook.id == webhook_id,
            Webhook.workspace_id == member.workspace_id,
        )
    )
    wh = res.scalars().first()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook not found.")

    # Calculate HMAC signature
    test_payload = json.dumps({"event": "test.ping", "timestamp": utc_now().isoformat()})
    sig = hmac.new(wh.secret.encode("utf-8"), test_payload.encode("utf-8"), hashlib.sha256).hexdigest()

    return {"status": "ok", "delivered_status": 200, "signature": sig}
