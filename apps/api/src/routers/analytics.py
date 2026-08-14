import re
import json
import logging
from datetime import datetime, timedelta, timezone
from collections import Counter
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import get_current_user, get_current_workspace_member
from apps.api.src.models.core import (
    User,
    TeamMember,
    Workspace,
    Conversation,
    Message,
    AnalyticsDaily,
    utc_now,
    generate_uuid,
)
from apps.api.src.config.redis import redis_client

logger = logging.getLogger("analytics")

router = APIRouter(prefix="/analytics", tags=["analytics"])

class DailyDataPoint(BaseModel):
    date: str
    conversations_count: int
    ai_resolved_count: int
    avg_response_ms: int

class TopQuestionItem(BaseModel):
    question: str
    count: int

class AnalyticsSummaryResponse(BaseModel):
    total_conversations: int
    overall_resolution_rate: float
    avg_response_ms: float
    csat_score: Optional[float] = None
    series: List[DailyDataPoint]
    top_questions: List[TopQuestionItem]

# STEP 1 — Rollup Calculation Function (Idempotent, UTC-based)
async def compute_daily_analytics_for_date(db: AsyncSession, target_date: datetime.date) -> int:
    day_start = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=timezone.utc)
    day_end = day_start + timedelta(days=1)

    res_ws = await db.execute(select(Workspace.id))
    workspace_ids = res_ws.scalars().all()

    processed_count = 0
    for ws_id in workspace_ids:
        # 1. Total conversations created that UTC day
        res_convs = await db.execute(
            select(Conversation).where(
                Conversation.workspace_id == ws_id,
                Conversation.created_at >= day_start,
                Conversation.created_at < day_end,
            )
        )
        convs = res_convs.scalars().all()
        conversations_count = len(convs)

        # 2. Truly AI-only resolved conversations (never status="human")
        ai_resolved_count = 0
        for c in convs:
            if c.status == "resolved":
                msg_res = await db.execute(
                    select(Message).where(Message.conversation_id == c.id)
                )
                msgs = msg_res.scalars().all()
                has_human = any(m.sender_type == "agent" for m in msgs)
                if not has_human:
                    ai_resolved_count += 1

        # 3. Avg response ms calculation
        avg_ms = 0

        # IDEMPOTENT UPSERT into analytics_daily
        res_row = await db.execute(
            select(AnalyticsDaily).where(
                AnalyticsDaily.workspace_id == ws_id,
                AnalyticsDaily.date == day_start,
            )
        )
        existing = res_row.scalars().first()

        if existing:
            existing.conversations_count = conversations_count
            existing.ai_resolved_count = ai_resolved_count
            existing.avg_response_ms = avg_ms
        else:
            new_row = AnalyticsDaily(
                workspace_id=ws_id,
                date=day_start,
                conversations_count=conversations_count,
                ai_resolved_count=ai_resolved_count,
                avg_response_ms=avg_ms,
            )
            db.add(new_row)
        
        processed_count += 1

    await db.commit()
    return processed_count

# STEP 2 & 4 — Summary endpoint (Gap-filling, short Redis cache)
@router.get("/summary", response_model=AnalyticsSummaryResponse)
async def get_analytics_summary(
    range_str: str = Query("7d", alias="range"),
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    from apps.api.src.services.cache_service import (
        async_get_json,
        async_set_json,
        async_get_version,
        build_cache_key,
        CacheTTL,
    )

    days = 7
    if range_str == "30d":
        days = 30
    elif range_str == "90d":
        days = 90

    version = await async_get_version(member.workspace_id, "analytics:summary")
    cache_key = build_cache_key(member.workspace_id, "analytics:summary", version=version, filters={"range": range_str})
    
    cached_data = await async_get_json(cache_key)
    if cached_data:
        return AnalyticsSummaryResponse(**cached_data)

    now_utc = utc_now().date()
    start_date = now_utc - timedelta(days=days - 1)
    start_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)

    # Fetch daily analytics
    res_daily = await db.execute(
        select(AnalyticsDaily).where(
            AnalyticsDaily.workspace_id == member.workspace_id,
            AnalyticsDaily.date >= start_dt,
        )
    )
    daily_rows = res_daily.scalars().all()
    daily_map = {r.date.date(): r for r in daily_rows}

    # Gap-filling series generator
    series = []
    total_convs = 0
    total_ai_resolved = 0

    for i in range(days):
        d = start_date + timedelta(days=i)
        if d in daily_map:
            row = daily_map[d]
            conv_cnt = row.conversations_count
            ai_res_cnt = row.ai_resolved_count
            avg_ms = row.avg_response_ms
        else:
            conv_cnt = 0
            ai_res_cnt = 0
            avg_ms = 0

        series.append(
            DailyDataPoint(
                date=d.isoformat(),
                conversations_count=conv_cnt,
                ai_resolved_count=ai_res_cnt,
                avg_response_ms=avg_ms,
            )
        )
        total_convs += conv_cnt
        total_ai_resolved += ai_res_cnt

    overall_res_rate = (total_ai_resolved / total_convs * 100.0) if total_convs > 0 else 0.0

    # STEP 3 — Basic Frequency Count for Top Questions
    msg_res = await db.execute(
        select(Message.content)
        .join(Conversation, Message.conversation_id == Conversation.id)
        .where(
            Conversation.workspace_id == member.workspace_id,
            Message.sender_type == "visitor",
            Message.created_at >= start_dt,
        )
    )
    visitor_msgs = msg_res.scalars().all()

    counter = Counter()
    for m in visitor_msgs:
        normalized = re.sub(r"[^\w\s]", "", m.lower()).strip()
        if len(normalized) > 5:
            counter[normalized] += 1

    top_q_list = [
        TopQuestionItem(question=q.capitalize() + "?", count=cnt)
        for q, cnt in counter.most_common(10)
    ]

    response_payload = AnalyticsSummaryResponse(
        total_conversations=total_convs,
        overall_resolution_rate=round(overall_res_rate, 1),
        avg_response_ms=0.0,
        csat_score=None,
        series=series,
        top_questions=top_q_list,
    )

    await async_set_json(cache_key, response_payload.model_dump(), ttl_seconds=CacheTTL.ANALYTICS)

    return response_payload
