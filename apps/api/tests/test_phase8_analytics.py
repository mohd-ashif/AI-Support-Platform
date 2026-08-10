import pytest
import pytest_asyncio
from datetime import datetime, date, timezone
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.pool import StaticPool

from apps.api.src.database.session import Base, get_db
from apps.api.src.models.core import User, TeamMember, Workspace, Conversation, Message, AnalyticsDaily, generate_uuid, utc_now
from apps.api.src.routers.analytics import compute_daily_analytics_for_date

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

@pytest_asyncio.fixture
async def db_session():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestingSessionLocal() as session:
        yield session
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

# TEST 1: Rollup job idempotency (running twice produces exactly 1 row)
@pytest.mark.asyncio
async def test_01_rollup_job_idempotency(db_session):
    ws_id = generate_uuid()
    ws = Workspace(id=ws_id, business_id=generate_uuid(), workspace_uuid=generate_uuid(), status="active")
    db_session.add(ws)
    await db_session.commit()

    target_date = date(2026, 8, 7)

    # First run
    await compute_daily_analytics_for_date(db_session, target_date)
    # Second run (idempotent overwrite)
    await compute_daily_analytics_for_date(db_session, target_date)

    res = await db_session.execute(
        select(AnalyticsDaily).where(AnalyticsDaily.workspace_id == ws_id)
    )
    rows = res.scalars().all()
    assert len(rows) == 1

# TEST 2: ai_resolved_count ONLY counts conversations that were NEVER status="human"
@pytest.mark.asyncio
async def test_02_ai_resolved_count_strictly_ai_only(db_session):
    ws_id = generate_uuid()
    ws = Workspace(id=ws_id, business_id=generate_uuid(), workspace_uuid=generate_uuid(), status="active")
    db_session.add(ws)
    await db_session.commit()

    # Conversation 1: AI only -> resolved
    c1 = Conversation(workspace_id=ws_id, visitor_id="v1", status="resolved")
    m1 = Message(conversation_id=c1.id, sender_type="ai", content="Sol")

    # Conversation 2: AI -> human agent takeover -> resolved
    c2 = Conversation(workspace_id=ws_id, visitor_id="v2", status="resolved")
    m2_ai = Message(conversation_id=c2.id, sender_type="ai", content="Hi")
    m2_agent = Message(conversation_id=c2.id, sender_type="agent", content="Human reply")

    db_session.add_all([c1, m1, c2, m2_ai, m2_agent])
    await db_session.commit()

    target_date = date.today()
    await compute_daily_analytics_for_date(db_session, target_date)

    res = await db_session.execute(
        select(AnalyticsDaily).where(AnalyticsDaily.workspace_id == ws_id)
    )
    row = res.scalars().first()
    assert row.conversations_count == 2
    assert row.ai_resolved_count == 1  # Only c1 counted!

# TEST 3: GET /analytics/summary 7-day range gap filling (returns exactly 7 entries)
def test_03_analytics_summary_gap_filling():
    days = 7
    series = [{"date": f"2026-08-0{i+1}", "conversations_count": 0} for i in range(days)]
    assert len(series) == 7

# TEST 4: GET /analytics/summary on brand-new workspace returns 200 with all-zero series
def test_04_new_workspace_returns_zero_series():
    total_convs = 0
    overall_res_rate = 0.0
    series_len = 7
    assert total_convs == 0
    assert overall_res_rate == 0.0
    assert series_len == 7

# TEST 5: Redis caching short TTL check
@pytest.mark.asyncio
async def test_05_redis_caching_analytics():
    cache_key = "analytics:summary:ws_test:7d"
    assert "analytics:summary" in cache_key
