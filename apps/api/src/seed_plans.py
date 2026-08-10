import asyncio
import logging
from sqlalchemy import select
from apps.api.src.database.session import AsyncSessionLocal
from apps.api.src.models.core import Plan
from apps.api.src.config.settings import settings

logger = logging.getLogger("seed_plans")

SEED_PLANS = [
    {
        "id": "plan_free_trial",
        "name": "Free Trial",
        "price_monthly_cents": 0,
        "price_annual_cents": 0,
        "stripe_price_id_monthly": None,
        "stripe_price_id_annual": None,
        "message_limit": 100,
        "seat_limit": 1,
        "trial_days": 14,
        "features_json": {"sources_limit": 2, "analytics": False},
    },
    {
        "id": "plan_starter",
        "name": "Starter",
        "price_monthly_cents": 2900,
        "price_annual_cents": 29000,
        "stripe_price_id_monthly": settings.STRIPE_PRICE_ID_STARTER_MONTHLY,
        "stripe_price_id_annual": settings.STRIPE_PRICE_ID_STARTER_ANNUAL,
        "message_limit": 1000,
        "seat_limit": 3,
        "trial_days": None,
        "features_json": {"sources_limit": 5, "analytics": True},
    },
    {
        "id": "plan_pro",
        "name": "Pro",
        "price_monthly_cents": 9900,
        "price_annual_cents": 99000,
        "stripe_price_id_monthly": settings.STRIPE_PRICE_ID_PRO_MONTHLY,
        "stripe_price_id_annual": settings.STRIPE_PRICE_ID_PRO_ANNUAL,
        "message_limit": 5000,
        "seat_limit": 10,
        "trial_days": None,
        "features_json": {"sources_limit": 20, "analytics": True, "api_access": True},
    },
    {
        "id": "plan_business",
        "name": "Business",
        "price_monthly_cents": 29900,
        "price_annual_cents": 299000,
        "stripe_price_id_monthly": settings.STRIPE_PRICE_ID_BUSINESS_MONTHLY,
        "stripe_price_id_annual": settings.STRIPE_PRICE_ID_BUSINESS_ANNUAL,
        "message_limit": -1,  # -1 represents unlimited messages
        "seat_limit": -1,     # -1 represents unlimited seats
        "trial_days": None,
        "features_json": {
            "sources_limit": -1,
            "analytics": True,
            "api_access": True,
            "webhooks": True,
        },
    },
]

async def seed_plans():
    async with AsyncSessionLocal() as db:
        for plan_data in SEED_PLANS:
            stmt = select(Plan).where((Plan.id == plan_data["id"]) | (Plan.name == plan_data["name"]))
            res = await db.execute(stmt)
            existing = res.scalars().first()

            if existing:
                existing.price_monthly_cents = plan_data["price_monthly_cents"]
                existing.price_annual_cents = plan_data["price_annual_cents"]
                existing.stripe_price_id_monthly = plan_data["stripe_price_id_monthly"]
                existing.stripe_price_id_annual = plan_data["stripe_price_id_annual"]
                existing.message_limit = plan_data["message_limit"]
                existing.seat_limit = plan_data["seat_limit"]
                existing.trial_days = plan_data["trial_days"]
                existing.features_json = plan_data["features_json"]
            else:
                new_plan = Plan(**plan_data)
                db.add(new_plan)
        
        await db.commit()
        print("Successfully seeded all 4 subscription plans into database.")

if __name__ == "__main__":
    asyncio.run(seed_plans())
