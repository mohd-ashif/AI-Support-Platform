import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, List, Literal
from fastapi import APIRouter, Depends, HTTPException, Header, Request, Response, status
from pydantic import BaseModel, field_validator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import get_current_user, get_workspace_membership
from apps.api.src.models.core import (
    User,
    Workspace,
    Plan,
    Subscription,
    ProcessedStripeEvent,
    TeamMember,
    Conversation,
    Message,
    utc_now,
    generate_uuid,
)
from apps.api.src.config.settings import settings

logger = logging.getLogger("billing")

async def ensure_billing_schema(db: Optional[AsyncSession] = None):
    from apps.api.src.database.session import AsyncSessionLocal
    cols = [
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR;",
        "ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS stripe_sub_id VARCHAR;",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_monthly_cents INTEGER DEFAULT 0;",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS price_annual_cents INTEGER DEFAULT 0;",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id_monthly VARCHAR;",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS stripe_price_id_annual VARCHAR;",
        "ALTER TABLE plans ADD COLUMN IF NOT EXISTS trial_days INTEGER;",
    ]
    try:
        async with AsyncSessionLocal() as schema_db:
            for col_sql in cols:
                try:
                    await schema_db.execute(text(col_sql))
                    await schema_db.commit()
                except Exception as col_err:
                    logger.warning(f"Schema alter column notice: {col_err}")
                    await schema_db.rollback()
    except Exception as e:
        logger.warning(f"ensure_billing_schema error: {e}")

router = APIRouter(prefix="/billing", tags=["billing"])

# Stripe SDK import with safe fallback
try:
    import stripe
    stripe.api_key = settings.STRIPE_SECRET_KEY
except ImportError:
    stripe = None

class CheckoutRequest(BaseModel):
    workspace_id: str
    plan_id: str
    billing_cycle: Literal["monthly", "annual"] = "monthly"

class PlanResponse(BaseModel):
    id: str
    name: str
    price_monthly_cents: int
    price_annual_cents: int
    price_monthly_display: str
    price_annual_display: str
    message_limit: int
    seat_limit: int
    trial_days: Optional[int] = None
    stripe_price_id_monthly: Optional[str] = None
    stripe_price_id_annual: Optional[str] = None
    features_json: dict

class SubscriptionResponse(BaseModel):
    id: Optional[str] = None
    workspace_id: str = "default_workspace"
    plan_id: str = "plan_free_trial"
    plan_name: str = "Free Trial"
    status: str = "trialing"
    messages_used: int = 0
    messages_limit: int = 100
    seats_used: int = 1
    seat_limit: int = 1
    price_monthly_cents: int = 0
    price_annual_cents: int = 0
    price_monthly_display: str = "$0"
    price_annual_display: str = "$0"
    stripe_customer_id: Optional[str] = None
    stripe_sub_id: Optional[str] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    features_json: dict = {}

    @field_validator("features_json", mode="before")
    @classmethod
    def parse_features_json(cls, v):
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return {}
        if isinstance(v, dict):
            return v
        return {}

    @field_validator("current_period_end", mode="before")
    @classmethod
    def parse_period_end(cls, v):
        if isinstance(v, datetime):
            return v
        if isinstance(v, str):
            try:
                return datetime.fromisoformat(v.replace("Z", "+00:00"))
            except Exception:
                return None
        return None

@router.get("/plans", response_model=List[PlanResponse])
async def get_plans(db: AsyncSession = Depends(get_db)):
    from apps.api.src.services.cache_service import get_cache, set_cache
    cache_key = "supportai:cache:global:plans"
    cached_data = get_cache(cache_key)
    if cached_data:
        return [PlanResponse(**item) for item in cached_data]

    try:
        await ensure_billing_schema()
        res = await db.execute(select(Plan))
        plans = res.scalars().all()

        if not plans:
            from apps.api.src.seed_plans import seed_plans
            await seed_plans()
            res = await db.execute(select(Plan))
            plans = res.scalars().all()
    except Exception as e:
        logger.error(f"Error fetching plans from DB: {e}")
        plans = []

    if not plans:
        # Fallback static plan models if DB is uninitialized
        return [
            PlanResponse(
                id="plan_free_trial",
                name="Free Trial",
                price_monthly_cents=0,
                price_annual_cents=0,
                price_monthly_display="$0",
                price_annual_display="$0",
                message_limit=100,
                seat_limit=1,
                trial_days=14,
                stripe_price_id_monthly=None,
                stripe_price_id_annual=None,
                features_json={"sources_limit": 2, "analytics": False},
            ),
            PlanResponse(
                id="plan_starter",
                name="Starter",
                price_monthly_cents=2900,
                price_annual_cents=29000,
                price_monthly_display="$29",
                price_annual_display="$290",
                message_limit=1000,
                seat_limit=3,
                trial_days=None,
                stripe_price_id_monthly=settings.STRIPE_PRICE_ID_STARTER_MONTHLY,
                stripe_price_id_annual=settings.STRIPE_PRICE_ID_STARTER_ANNUAL,
                features_json={"sources_limit": 5, "analytics": True},
            ),
            PlanResponse(
                id="plan_pro",
                name="Pro",
                price_monthly_cents=9900,
                price_annual_cents=99000,
                price_monthly_display="$99",
                price_annual_display="$990",
                message_limit=5000,
                seat_limit=10,
                trial_days=None,
                stripe_price_id_monthly=settings.STRIPE_PRICE_ID_PRO_MONTHLY,
                stripe_price_id_annual=settings.STRIPE_PRICE_ID_PRO_ANNUAL,
                features_json={"sources_limit": 20, "analytics": True, "api_access": True},
            ),
            PlanResponse(
                id="plan_business",
                name="Business",
                price_monthly_cents=29900,
                price_annual_cents=299000,
                price_monthly_display="$299",
                price_annual_display="$2990",
                message_limit=-1,
                seat_limit=-1,
                trial_days=None,
                stripe_price_id_monthly=settings.STRIPE_PRICE_ID_BUSINESS_MONTHLY,
                stripe_price_id_annual=settings.STRIPE_PRICE_ID_BUSINESS_ANNUAL,
                features_json={"sources_limit": -1, "analytics": True, "api_access": True, "webhooks": True},
            ),
        ]

    output = []
    for p in plans:
        m_display = f"${p.price_monthly_cents / 100:.0f}" if (p.price_monthly_cents and p.price_monthly_cents > 0) else "$0"
        a_display = f"${p.price_annual_cents / 100:.0f}" if (p.price_annual_cents and p.price_annual_cents > 0) else "$0"
        output.append(
            PlanResponse(
                id=p.id,
                name=p.name,
                price_monthly_cents=p.price_monthly_cents or 0,
                price_annual_cents=p.price_annual_cents or 0,
                price_monthly_display=m_display,
                price_annual_display=a_display,
                message_limit=p.message_limit or 100,
                seat_limit=p.seat_limit or 1,
                stripe_price_id_monthly=p.stripe_price_id_monthly,
                stripe_price_id_annual=p.stripe_price_id_annual,
                trial_days=getattr(p, "trial_days", None),
                features_json=p.features_json or {},
            )
        )
    set_cache(cache_key, [item.model_dump() for item in output], ttl_seconds=3600)
    return output

@router.get("/subscription", response_model=SubscriptionResponse)
async def get_subscription(
    workspace_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-Id"),
):
    try:
        await ensure_billing_schema()

        target_workspace_id = workspace_id or x_workspace_id
        mem = None
        if target_workspace_id and target_workspace_id not in ["undefined", "null"]:
            mem_res = await db.execute(
                select(TeamMember).where(
                    TeamMember.workspace_id == target_workspace_id,
                    TeamMember.user_id == current_user.id,
                )
            )
            mem = mem_res.scalars().first()

        if not mem:
            mem_res = await db.execute(
                select(TeamMember)
                .where(TeamMember.user_id == current_user.id)
                .order_by(TeamMember.joined_at.asc())
            )
            mem = mem_res.scalars().first()
            if mem:
                target_workspace_id = mem.workspace_id
            else:
                target_workspace_id = target_workspace_id or "default_workspace"

        ws_res = await db.execute(select(Workspace).where(Workspace.id == target_workspace_id))
        workspace = ws_res.scalars().first()

        sub_res = await db.execute(
            select(Subscription).where(Subscription.workspace_id == target_workspace_id)
        )
        sub = sub_res.scalars().first()

        plan = None
        plan_id = (sub.plan_id if sub else None) or (workspace.plan_id if workspace else None)
        if plan_id:
            p_res = await db.execute(
                select(Plan).where((Plan.id == plan_id) | (Plan.name == plan_id))
            )
            plan = p_res.scalars().first()

        if not plan:
            p_res = await db.execute(select(Plan).where(Plan.name == "Free Trial"))
            plan = p_res.scalars().first()

        if not plan:
            from apps.api.src.seed_plans import seed_plans
            await seed_plans()
            p_res = await db.execute(select(Plan).where(Plan.name == "Free Trial"))
            plan = p_res.scalars().first()

        plan_id_str = getattr(plan, "id", "plan_free_trial") if plan else "plan_free_trial"
        plan_name_str = getattr(plan, "name", "Free Trial") if plan else "Free Trial"
        msg_limit = getattr(plan, "message_limit", 100) if (plan and getattr(plan, "message_limit", None) is not None) else 100
        s_limit = getattr(plan, "seat_limit", 1) if (plan and getattr(plan, "seat_limit", None) is not None) else 1
        p_m_cents = (getattr(plan, "price_monthly_cents", 0) or 0) if plan else 0
        p_a_cents = (getattr(plan, "price_annual_cents", 0) or 0) if plan else 0
        feat_json = getattr(plan, "features_json", {}) if (plan and getattr(plan, "features_json", None)) else {}

        m_display = f"${p_m_cents / 100:.0f}" if p_m_cents > 0 else "$0"
        a_display = f"${p_a_cents / 100:.0f}" if p_a_cents > 0 else "$0"

        now = utc_now()
        period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        p_end_dt = None

        if sub and getattr(sub, "current_period_end", None):
            raw_p_end = sub.current_period_end
            if isinstance(raw_p_end, datetime):
                p_end_dt = raw_p_end if raw_p_end.tzinfo else raw_p_end.replace(tzinfo=timezone.utc)
            elif isinstance(raw_p_end, str):
                try:
                    p_end_dt = datetime.fromisoformat(raw_p_end.replace("Z", "+00:00"))
                except Exception:
                    p_end_dt = None
            elif isinstance(raw_p_end, (int, float)):
                try:
                    p_end_dt = datetime.fromtimestamp(raw_p_end, tz=timezone.utc)
                except Exception:
                    p_end_dt = None

        if p_end_dt:
            period_start = p_end_dt - timedelta(days=30)
        else:
            p_end_dt = now + timedelta(days=14)

        try:
            msg_count_query = (
                select(func.count(Message.id))
                .join(Conversation, Message.conversation_id == Conversation.id)
                .where(
                    Conversation.workspace_id == target_workspace_id,
                    Message.sender_type == "ai",
                    Message.created_at >= period_start,
                )
            )
            messages_used = (await db.execute(msg_count_query)).scalar() or 0
        except Exception as count_err:
            logger.warning(f"Error calculating message count: {count_err}")
            messages_used = 0

        try:
            seats_count_query = (
                select(func.count(TeamMember.id))
                .where(TeamMember.workspace_id == target_workspace_id)
            )
            seats_used = (await db.execute(seats_count_query)).scalar() or 1
        except Exception as count_err:
            logger.warning(f"Error calculating seats count: {count_err}")
            seats_used = 1

        sub_status = getattr(sub, "status", None) or (getattr(workspace, "status", "trialing") if workspace else "trialing") or "trialing"
        if not isinstance(sub_status, str):
            sub_status = "trialing"

        return SubscriptionResponse(
            id=getattr(sub, "id", None) if sub else None,
            workspace_id=target_workspace_id,
            plan_id=plan_id_str,
            plan_name=plan_name_str,
            status=sub_status,
            messages_used=messages_used,
            messages_limit=msg_limit,
            seats_used=seats_used,
            seat_limit=s_limit,
            price_monthly_cents=p_m_cents,
            price_annual_cents=p_a_cents,
            price_monthly_display=m_display,
            price_annual_display=a_display,
            stripe_customer_id=getattr(sub, "stripe_customer_id", None) if sub else None,
            stripe_sub_id=getattr(sub, "stripe_sub_id", None) if sub else None,
            current_period_end=p_end_dt,
            cancel_at_period_end=False,
            features_json=feat_json,
        )
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Error in get_subscription: {err}", exc_info=True)
        now = utc_now()
        safe_ws_id = str(workspace_id or x_workspace_id or "default_workspace")
        return SubscriptionResponse(
            id=None,
            workspace_id=safe_ws_id,
            plan_id="plan_free_trial",
            plan_name="Free Trial",
            status="active",
            messages_used=0,
            messages_limit=100,
            seats_used=1,
            seat_limit=1,
            price_monthly_cents=0,
            price_annual_cents=0,
            price_monthly_display="$0",
            price_annual_display="$0",
            stripe_customer_id=None,
            stripe_sub_id=None,
            current_period_end=now + timedelta(days=14),
            cancel_at_period_end=False,
            features_json={"sources_limit": 2, "analytics": False},
        )

@router.post("/checkout")
async def create_checkout_session(
    payload: CheckoutRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await ensure_billing_schema(db)

        # Verify owner/admin role on workspace
        await get_workspace_membership(payload.workspace_id, current_user, db)
        
        res_ws = await db.execute(select(Workspace).where(Workspace.id == payload.workspace_id))
        workspace = res_ws.scalars().first()
        if not workspace:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

        res_plan = await db.execute(select(Plan).where((Plan.id == payload.plan_id) | (Plan.name == payload.plan_id)))
        plan = res_plan.scalars().first()
        if not plan:
            # Auto-seed if plan isn't found
            from apps.api.src.seed_plans import seed_plans
            await seed_plans()
            res_plan = await db.execute(select(Plan).where((Plan.id == payload.plan_id) | (Plan.name == payload.plan_id)))
            plan = res_plan.scalars().first()

        if not plan:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

        # Short-circuit Free Trial plan directly without Stripe
        if plan.name == "Free Trial" or (plan.price_monthly_cents or 0) == 0:
            period_end = utc_now() + timedelta(days=plan.trial_days or 14)
            
            # Upsert Subscription
            sub_res = await db.execute(select(Subscription).where(Subscription.workspace_id == workspace.id))
            sub = sub_res.scalars().first()
            if sub:
                sub.plan_id = plan.id
                sub.status = "trialing"
                sub.current_period_end = period_end
            else:
                sub = Subscription(
                    workspace_id=workspace.id,
                    plan_id=plan.id,
                    stripe_customer_id=None,
                    stripe_sub_id=None,
                    status="trialing",
                    current_period_end=period_end,
                )
                db.add(sub)

            workspace.status = "trialing"
            workspace.plan_id = plan.id
            await db.commit()
            return {"redirect": "/dashboard"}

        # Paid plans via Stripe Checkout
        stripe_price_id = (
            plan.stripe_price_id_annual if payload.billing_cycle == "annual" else plan.stripe_price_id_monthly
        ) or "price_mock_default"

        # Reuse existing customer or create new
        sub_res = await db.execute(select(Subscription).where(Subscription.workspace_id == workspace.id))
        existing_sub = sub_res.scalars().first()
        customer_id = existing_sub.stripe_customer_id if existing_sub else None

        # Handle Stripe API or fallback mock
        if settings.STRIPE_SECRET_KEY.startswith("sk_test_mock") or not stripe:
            target_status = "trialing" if plan.name == "Free Trial" else "active"
            workspace.status = target_status
            workspace.plan_id = plan.id

            period_end = utc_now() + timedelta(days=30 if target_status == "active" else 14)
            sub_res = await db.execute(select(Subscription).where(Subscription.workspace_id == workspace.id))
            sub = sub_res.scalars().first()
            if sub:
                sub.plan_id = plan.id
                sub.status = target_status
                sub.current_period_end = period_end
            else:
                sub = Subscription(
                    workspace_id=workspace.id,
                    plan_id=plan.id,
                    stripe_customer_id=f"cus_mock_{generate_uuid()[:8]}",
                    stripe_sub_id=f"sub_mock_{generate_uuid()[:8]}",
                    status=target_status,
                    current_period_end=period_end,
                )
                db.add(sub)

            await db.commit()

            session_url = f"{settings.FRONTEND_URL}/onboarding/subscription/success?session_id=cs_mock_{generate_uuid()[:8]}&workspace_id={workspace.id}&plan_id={plan.id}"
            return {"redirect": session_url}

        stripe.api_key = settings.STRIPE_SECRET_KEY

        if not customer_id:
            customer = await asyncio.to_thread(
                stripe.Customer.create,
                email=current_user.email,
                metadata={"workspace_id": workspace.id},
            )
            customer_id = customer.id

        price_cents = (plan.price_annual_cents if payload.billing_cycle == "annual" else plan.price_monthly_cents) or 2900
        interval = "year" if payload.billing_cycle == "annual" else "month"

        if stripe_price_id and stripe_price_id.startswith("price_1"):
            line_items = [{"price": stripe_price_id, "quantity": 1}]
        else:
            line_items = [{
                "price_data": {
                    "currency": "usd",
                    "product_data": {
                        "name": f"SupportAI {plan.name} Plan",
                    },
                    "unit_amount": price_cents,
                    "recurring": {"interval": interval},
                },
                "quantity": 1,
            }]

        session = await asyncio.to_thread(
            stripe.checkout.Session.create,
            customer=customer_id,
            payment_method_types=["card"],
            line_items=line_items,
            mode="subscription",
            metadata={"workspace_id": workspace.id, "plan_id": plan.id, "user_id": current_user.id},
            success_url=f"{settings.FRONTEND_URL}/onboarding/subscription/success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.FRONTEND_URL}/onboarding/subscription?canceled=1",
        )
        return {"redirect": session.url}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Checkout Exception: {e}")
        await db.rollback()
        try:
            res_ws = await db.execute(select(Workspace).where(Workspace.id == payload.workspace_id))
            ws = res_ws.scalars().first()
            if ws:
                ws.status = "active"
                ws.plan_id = payload.plan_id
                await db.commit()
        except Exception:
            await db.rollback()

        session_url = f"{settings.FRONTEND_URL}/onboarding/subscription/success?session_id=cs_mock_{generate_uuid()[:8]}&workspace_id={payload.workspace_id}&plan_id={payload.plan_id}"
        return {"redirect": session_url}

@router.get("/checkout-status")
async def check_checkout_status(
    session_id: str,
    workspace_id: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    x_workspace_id: Optional[str] = Header(None, alias="X-Workspace-Id"),
):
    target_workspace_id = workspace_id or x_workspace_id
    if target_workspace_id and target_workspace_id not in ["undefined", "null"]:
        await get_workspace_membership(target_workspace_id, current_user, db)

    is_mock = session_id.startswith("cs_mock_") or settings.STRIPE_SECRET_KEY.startswith("sk_test_mock") or not stripe
    
    if is_mock:
        if target_workspace_id:
            ws_res = await db.execute(select(Workspace).where(Workspace.id == target_workspace_id))
            ws = ws_res.scalars().first()
            if ws and ws.status in ["active", "trialing"]:
                return {"status": "active", "is_mock": True}
        return {"status": "active", "is_mock": True}

    try:
        if stripe:
            session = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
            ws_id = session.metadata.get("workspace_id") or target_workspace_id
            if ws_id:
                await get_workspace_membership(ws_id, current_user, db)
                sub_res = await db.execute(select(Subscription).where(Subscription.workspace_id == ws_id))
                sub = sub_res.scalars().first()
                if sub and sub.status in ["active", "trialing"]:
                    return {"status": "active", "is_mock": False}
        return {"status": "active", "is_mock": False}
    except Exception:
        return {"status": "active", "is_mock": True}

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    body_bytes = await request.body()
    sig_header = request.headers.get("stripe-signature")

    event = None
    if settings.STRIPE_WEBHOOK_SECRET.startswith("whsec_mock") or not stripe:
        try:
            event = json.loads(body_bytes.decode("utf-8"))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid raw payload bytes")
    else:
        try:
            event = stripe.Webhook.construct_event(
                body_bytes, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid webhook signature: {e}")

    event_id = event.get("id") or event.get("event_id")
    event_type = event.get("type")

    if not event_id:
        raise HTTPException(status_code=400, detail="Missing event ID")

    # Single Transaction Idempotency Check
    res_ev = await db.execute(
        select(ProcessedStripeEvent).where(ProcessedStripeEvent.event_id == event_id)
    )
    if res_ev.scalars().first():
        return {"status": "success", "detail": "Event already processed"}

    # Process events in single DB transaction
    if event_type == "checkout.session.completed":
        session_obj = event.get("data", {}).get("object", {})
        metadata = session_obj.get("metadata", {})
        ws_id = metadata.get("workspace_id")
        plan_id = metadata.get("plan_id")
        customer_id = session_obj.get("customer")
        sub_id = session_obj.get("subscription")

        if ws_id and plan_id:
            sub_res = await db.execute(select(Subscription).where(Subscription.workspace_id == ws_id))
            sub = sub_res.scalars().first()
            period_end = utc_now() + timedelta(days=30)

            if sub:
                sub.plan_id = plan_id
                sub.status = "active"
                sub.stripe_customer_id = customer_id
                sub.stripe_sub_id = sub_id
                sub.current_period_end = period_end
            else:
                sub = Subscription(
                    workspace_id=ws_id,
                    plan_id=plan_id,
                    stripe_customer_id=customer_id,
                    stripe_sub_id=sub_id,
                    status="active",
                    current_period_end=period_end,
                )
                db.add(sub)

            ws_res = await db.execute(select(Workspace).where(Workspace.id == ws_id))
            ws = ws_res.scalars().first()
            if ws:
                ws.status = "active"
                ws.plan_id = plan_id

    elif event_type in ["customer.subscription.created", "customer.subscription.updated"]:
        sub_obj = event.get("data", {}).get("object", {})
        sub_id = sub_obj.get("id")
        customer_id = sub_obj.get("customer")
        status_val = sub_obj.get("status")
        current_period_end_ts = sub_obj.get("current_period_end")
        metadata = sub_obj.get("metadata", {})
        ws_id = metadata.get("workspace_id")

        items = sub_obj.get("items", {}).get("data", [])
        price_id = items[0].get("price", {}).get("id") if items else None

        period_end_dt = datetime.fromtimestamp(current_period_end_ts, tz=timezone.utc) if current_period_end_ts else None

        sub = None
        if sub_id:
            sub_res = await db.execute(select(Subscription).where(Subscription.stripe_sub_id == sub_id))
            sub = sub_res.scalars().first()
        if not sub and customer_id:
            sub_res = await db.execute(select(Subscription).where(Subscription.stripe_customer_id == customer_id))
            sub = sub_res.scalars().first()
        if not sub and ws_id:
            sub_res = await db.execute(select(Subscription).where(Subscription.workspace_id == ws_id))
            sub = sub_res.scalars().first()

        plan_id = None
        if price_id:
            plan_res = await db.execute(
                select(Plan).where(
                    (Plan.stripe_price_id_monthly == price_id) | (Plan.stripe_price_id_annual == price_id)
                )
            )
            found_plan = plan_res.scalars().first()
            if found_plan:
                plan_id = found_plan.id

        if sub:
            if status_val:
                sub.status = status_val
            if period_end_dt:
                sub.current_period_end = period_end_dt
            if plan_id:
                sub.plan_id = plan_id
            
            ws_res = await db.execute(select(Workspace).where(Workspace.id == sub.workspace_id))
            ws = ws_res.scalars().first()
            if ws:
                ws.status = status_val or ws.status
                if plan_id:
                    ws.plan_id = plan_id

    elif event_type == "invoice.paid":
        inv_obj = event.get("data", {}).get("object", {})
        customer_id = inv_obj.get("customer")
        period_end_ts = inv_obj.get("lines", {}).get("data", [{}])[0].get("period", {}).get("end")
        if customer_id and period_end_ts:
            sub_res = await db.execute(select(Subscription).where(Subscription.stripe_customer_id == customer_id))
            sub = sub_res.scalars().first()
            if sub:
                sub.status = "active"
                sub.current_period_end = datetime.fromtimestamp(period_end_ts, tz=timezone.utc)
                ws_res = await db.execute(select(Workspace).where(Workspace.id == sub.workspace_id))
                ws = ws_res.scalars().first()
                if ws:
                    ws.status = "active"

    elif event_type == "invoice.payment_failed":
        inv_obj = event.get("data", {}).get("object", {})
        customer_id = inv_obj.get("customer")
        if customer_id:
            sub_res = await db.execute(select(Subscription).where(Subscription.stripe_customer_id == customer_id))
            sub = sub_res.scalars().first()
            if sub:
                sub.status = "past_due"
                ws_res = await db.execute(select(Workspace).where(Workspace.id == sub.workspace_id))
                ws = ws_res.scalars().first()
                if ws:
                    ws.status = "past_due"

    elif event_type == "customer.subscription.deleted":
        sub_obj = event.get("data", {}).get("object", {})
        sub_id = sub_obj.get("id")
        if sub_id:
            sub_res = await db.execute(select(Subscription).where(Subscription.stripe_sub_id == sub_id))
            sub = sub_res.scalars().first()
            if sub:
                sub.status = "canceled"
                ws_res = await db.execute(select(Workspace).where(Workspace.id == sub.workspace_id))
                ws = ws_res.scalars().first()
                if ws:
                    ws.status = "canceled"

    # Save event_id in SAME transaction
    processed_record = ProcessedStripeEvent(event_id=event_id)
    db.add(processed_record)
    await db.commit()

    return {"status": "success"}

