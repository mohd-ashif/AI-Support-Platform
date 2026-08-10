from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Query, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import get_current_user
from apps.api.src.models.core import User
from apps.api.src.routers.analytics import compute_daily_analytics_for_date

router = APIRouter(prefix="/admin", tags=["admin"])

class AdminOverviewResponse(BaseModel):
    total_users: int
    total_workspaces: int
    system_status: str
    active_connections: int

@router.get("/overview", response_model=AdminOverviewResponse)
async def get_admin_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return AdminOverviewResponse(
        total_users=42,
        total_workspaces=18,
        system_status="healthy",
        active_connections=12,
    )

@router.post("/analytics/backfill")
async def backfill_analytics_date(
    date_str: str = Query(..., alias="date"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        dt = datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")
    
    count = await compute_daily_analytics_for_date(db, dt)
    return {"status": "ok", "date": date_str, "processed_workspaces": count}

