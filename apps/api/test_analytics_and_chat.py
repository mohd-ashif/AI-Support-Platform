import sys
import os
import asyncio
from pathlib import Path

api_dir = Path(__file__).resolve().parent
project_root = api_dir.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(api_dir))

from dotenv import load_dotenv
load_dotenv(str(api_dir / ".env"))

from apps.api.src.config.settings import settings

async def run_verification():
    print("=" * 70)
    print("VERIFICATION TEST: Analytics API & Chat RAG Pipeline")
    print("=" * 70)

    # 1. Test Analytics API Endpoint via AsyncSession
    db_url = getattr(settings, "DATABASE_URL", "")
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy import select
    from apps.api.src.models.core import Workspace, TeamMember, KnowledgeChunk

    engine = create_async_engine(db_url)
    async with AsyncSession(engine) as session:
        res_ws = await session.execute(select(Workspace).order_by(Workspace.created_at.desc()).limit(1))
        ws = res_ws.scalars().first()
        if not ws:
            print("ERROR: No workspace found.")
            return

        workspace_id = ws.id
        print(f"\n[1/3] Testing Analytics summary logic for Workspace ID: {workspace_id} (UUID: {ws.workspace_uuid})")

        # Simulate analytics query for 7d
        from apps.api.src.routers.analytics import AnalyticsSummaryResponse, DailyDataPoint, TopQuestionItem
        from apps.api.src.models.core import AnalyticsDaily, Message, Conversation, utc_now
        from datetime import datetime, timedelta, timezone

        days = 7
        now_utc = utc_now().date()
        start_date = now_utc - timedelta(days=days - 1)
        start_dt = datetime(start_date.year, start_date.month, start_date.day, tzinfo=timezone.utc)

        res_daily = await session.execute(
            select(AnalyticsDaily).where(
                AnalyticsDaily.workspace_id == workspace_id,
                AnalyticsDaily.date >= start_dt,
            )
        )
        daily_rows = res_daily.scalars().all()
        print(f"Daily analytics rows fetched: {len(daily_rows)}")

        # 2. Test RAG Vector Search & Retrieval for Ashif/GitHub question
        test_question = "What programming languages and frameworks does Ashif use based on his GitHub?"
        print(f"\n[2/3] Testing RAG Context Retrieval for Question: '{test_question}'")

        from apps.api.src.graph.agent_graph import retrieve_knowledge_chunks, run_reasoner_node, GraphState

        chunks, confidence = await retrieve_knowledge_chunks(
            workspace_id=workspace_id,
            query=test_question,
            db=session,
        )
        print(f"Retrieved {len(chunks)} chunks with confidence: {confidence}")
        for idx, c in enumerate(chunks, 1):
            snippet = c['content'].replace('\n', ' ')[:120]
            print(f"  Chunk #{idx} [ID: {c['chunk_id']}] (Score: {c['similarity_score']}): {snippet}...")

        # 3. Test LLM Reasoning Node Generation
        print(f"\n[3/3] Testing LLM Generation with Dynamic System Prompt...")
        state: GraphState = {
            "workspace_id": workspace_id,
            "conversation_id": "test_conv_123",
            "visitor_message": test_question,
            "conversation_history": [],
            "retrieved_chunks": chunks,
            "retrieval_confidence": confidence,
            "turn_count_unresolved": 0,
            "should_escalate": False,
            "response_text": "",
        }
        ans_text, should_esc = await run_reasoner_node(state, db=session)
        print("\n" + "-" * 60)
        print("GENERATED RESPONSE FROM RAG PIPELINE:")
        print("-" * 60)
        print(ans_text)
        print("-" * 60)
        print(f"Should Escalate: {should_esc}")

    await engine.dispose()
    print("=" * 70)

if __name__ == "__main__":
    asyncio.run(run_verification())
