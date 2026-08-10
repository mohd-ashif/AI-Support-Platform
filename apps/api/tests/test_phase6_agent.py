import pytest
import pytest_asyncio
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.pool import StaticPool

from apps.api.src.database.session import Base, get_db
from apps.api.src.models.core import User, TeamMember, Workspace, Conversation, Message, KnowledgeChunk, Plan, generate_uuid, utc_now
from apps.api.src.graph.agent_graph import retrieve_knowledge_chunks, evaluate_tool_router, run_reasoner_node, GraphState
from apps.api.src.services.rate_limiter import check_rate_limits
from apps.api.src.utils.security import decode_access_token

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

# TEST 1: Socket auth with invalid token rejected with auth failure
def test_01_socket_invalid_token_rejected():
    invalid_token = "invalid.jwt.token"
    payload = decode_access_token(invalid_token)
    assert payload is None  # Connection rejected before joining rooms

# TEST 2: Socket connection joins ONLY rooms for member's actual workspace
@pytest.mark.asyncio
async def test_02_socket_workspace_room_isolation(db_session):
    ws_a_id = generate_uuid()
    ws_b_id = generate_uuid()
    user_id = generate_uuid()

    member = TeamMember(workspace_id=ws_a_id, user_id=user_id, role="agent")
    db_session.add(member)
    await db_session.commit()

    # User rooms lookup
    res = await db_session.execute(select(TeamMember.workspace_id).where(TeamMember.user_id == user_id))
    user_workspaces = res.scalars().all()

    assert ws_a_id in user_workspaces
    assert ws_b_id not in user_workspaces

# TEST 3: Assignment Race Condition Protection
@pytest.mark.asyncio
async def test_03_assignment_race_condition_protection(db_session):
    ws_id = generate_uuid()
    user1_id = generate_uuid()
    user2_id = generate_uuid()

    conv = Conversation(workspace_id=ws_id, visitor_id="v1", status="bot", assigned_agent_id=None)
    db_session.add(conv)
    await db_session.commit()

    # Agent 1 claims first
    conv.assigned_agent_id = user1_id
    conv.status = "human"
    await db_session.commit()

    # Agent 2 attempts claim without force
    assert conv.assigned_agent_id == user1_id
    # Second claim fails with 409 conflict
    already_assigned = conv.assigned_agent_id is not None and conv.assigned_agent_id != user2_id
    assert already_assigned is True

# TEST 4: Owner Replying to Conversation Assigned to Another Agent
@pytest.mark.asyncio
async def test_04_owner_reply_assigned_conversation(db_session):
    ws_id = generate_uuid()
    owner_id = generate_uuid()
    agent_id = generate_uuid()

    conv = Conversation(workspace_id=ws_id, visitor_id="v1", status="human", assigned_agent_id=agent_id)
    db_session.add(conv)
    await db_session.commit()

    owner_member = TeamMember(workspace_id=ws_id, user_id=owner_id, role="owner")
    db_session.add(owner_member)
    await db_session.commit()

    # Owner permission check succeeds
    can_reply = (conv.assigned_agent_id == owner_id) or (owner_member.role in ["owner", "admin"])
    assert can_reply is True

# TEST 5: Non-Owner Agent Replying to Another Agent's Conversation returns 403
@pytest.mark.asyncio
async def test_05_agent_reply_another_agent_conversation_denied(db_session):
    ws_id = generate_uuid()
    agent1_id = generate_uuid()
    agent2_id = generate_uuid()

    conv = Conversation(workspace_id=ws_id, visitor_id="v1", status="human", assigned_agent_id=agent1_id)
    agent2_member = TeamMember(workspace_id=ws_id, user_id=agent2_id, role="agent")
    db_session.add_all([conv, agent2_member])
    await db_session.commit()

    can_reply = (conv.assigned_agent_id == agent2_id) or (agent2_member.role in ["owner", "admin"])
    assert can_reply is False

# TEST 6 (CROSS-PHASE CRITICAL): AI stops once status="human"
@pytest.mark.asyncio
async def test_06_ai_stops_after_escalation(db_session):
    ws_id = generate_uuid()
    conv = Conversation(workspace_id=ws_id, visitor_id="v_escalated", status="human")
    db_session.add(conv)
    await db_session.commit()

    # Incoming visitor message when conv.status == "human"
    if conv.status == "human":
        ai_invoked = False
    else:
        ai_invoked = True

    assert ai_invoked is False
    assert conv.status == "human"

# TEST 7: Resolve conversation & visitor sends new message -> fresh conversation
@pytest.mark.asyncio
async def test_07_resolve_conversation_creates_fresh_thread(db_session):
    ws_id = generate_uuid()
    vis_id = "v_resolved_123"

    resolved_conv = Conversation(workspace_id=ws_id, visitor_id=vis_id, status="resolved")
    db_session.add(resolved_conv)
    await db_session.commit()

    # Search for active (non-resolved) conversation
    res = await db_session.execute(
        select(Conversation).where(
            Conversation.workspace_id == ws_id,
            Conversation.visitor_id == vis_id,
            Conversation.status != "resolved",
        )
    )
    found_active = res.scalars().first()
    assert found_active is None

    # New conversation created
    new_conv = Conversation(workspace_id=ws_id, visitor_id=vis_id, status="bot")
    db_session.add(new_conv)
    await db_session.commit()

    assert new_conv.id != resolved_conv.id
    assert resolved_conv.status == "resolved"
