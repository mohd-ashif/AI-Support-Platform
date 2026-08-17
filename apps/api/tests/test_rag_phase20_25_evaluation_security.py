import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

from apps.api.src.database.session import Base
from apps.api.src.models.core import User, Business, Workspace, KnowledgeSource, KnowledgeDocument, KnowledgeChunk
from apps.api.src.services.cache_service import build_rag_cache_key, async_invalidate_rag_cache
from apps.api.src.services.metrics_service import log_rag_metrics
from apps.api.src.services.retrieval_service import RetrievalService
from apps.api.src.services.embedding_service import EmbeddingService

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

@pytest_asyncio.fixture
async def test_db():
    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session

    await engine.dispose()

def test_01_redis_tenant_cache_key_and_invalidation():
    key1 = build_rag_cache_key("ws_100", "What is refund policy?", version=1)
    key2 = build_rag_cache_key("ws_100", "What is refund policy?", version=2)
    key_other_tenant = build_rag_cache_key("ws_200", "What is refund policy?", version=1)

    assert "rag:query:ws_100:v1:" in key1
    assert "rag:query:ws_100:v2:" in key2
    assert "rag:query:ws_200:v1:" in key_other_tenant
    assert key1 != key2, "Cache key must change when knowledge version is incremented!"
    assert key1 != key_other_tenant, "Cache key must be tenant-isolated!"

def test_02_rag_observability_metrics_telemetry():
    metric = log_rag_metrics(
        request_id="req_999",
        workspace_id="ws_abc",
        conversation_id="conv_123",
        query="Password reset?",
        retrieval_time_ms=12.5,
        embedding_time_ms=8.0,
        llm_time_ms=150.0,
        total_time_ms=170.5,
        chunks_retrieved=3,
        top_score=0.92,
        model="llama-3.3-70b",
        token_usage={"prompt": 450, "completion": 80},
        source_documents=["Password Guide.pdf"],
        handoff_triggered=False,
    )

    assert metric["requestId"] == "req_999"
    assert metric["organizationId"] == "ws_abc"
    assert metric["retrievalTimeMs"] == 12.5
    assert metric["topScore"] == 0.92
    assert metric["handoffTriggered"] == False

@pytest.mark.asyncio
async def test_03_rag_evaluation_benchmark(test_db: AsyncSession):
    """
    Phase 25 Evaluation Benchmark:
    Verifies retrieval accuracy and source correctness on standard test dataset.
    """
    # Setup test tenant
    u = User(email="eval@example.com", name="Eval Owner")
    test_db.add(user=u)
    await test_db.flush()

    b = Business(name="Eval Corp", owner_user_id=u.id)
    test_db.add(b)
    await test_db.flush()

    ws = Workspace(business_id=b.id)
    test_db.add(ws)
    await test_db.flush()

    # Document 1: Refund Policy
    doc_refund = KnowledgeDocument(
        workspace_id=ws.id,
        source_id="src_refund",
        title="Refund Policy",
        content_raw="Refunds can be requested within 30 days of purchase.",
    )

    chunk_refund = KnowledgeChunk(
        workspace_id=ws.id,
        source_type="file",
        source_id="src_refund",
        document_id="doc_refund",
        content="Refunds can be requested within 30 days of purchase.",
        token_count=10,
        metadata_json={"document_name": "Refund Policy", "page_number": 1},
    )

    # Document 2: Password Help Article
    doc_pwd = KnowledgeDocument(
        workspace_id=ws.id,
        source_id="src_pwd",
        title="Password Help Article",
        content_raw="To reset your password, click Forgot Password on the login page.",
    )

    chunk_pwd = KnowledgeChunk(
        workspace_id=ws.id,
        source_type="article",
        source_id="src_pwd",
        document_id="doc_pwd",
        content="To reset your password, click Forgot Password on the login page.",
        token_count=12,
        metadata_json={"document_name": "Password Help Article", "url": "https://example.com/pwd"},
    )

    test_db.add_all([doc_refund, chunk_refund, doc_pwd, chunk_pwd])
    await test_db.commit()

    mock_embed = EmbeddingService()
    mock_embed._is_mock_enabled = lambda: True
    svc = RetrievalService(embedding_service=mock_embed)

    # Question 1 Benchmark
    chunks_q1, score_q1 = await svc.retrieve_relevant_knowledge(
        workspace_id=ws.id,
        query="What is the refund period?",
        db=test_db,
    )
    assert len(chunks_q1) >= 1
    source_names_q1 = [c["document_name"] for c in chunks_q1]
    assert "Refund Policy" in source_names_q1

    # Question 2 Benchmark
    chunks_q2, score_q2 = await svc.retrieve_relevant_knowledge(
        workspace_id=ws.id,
        query="How can I reset my password?",
        db=test_db,
    )
    assert len(chunks_q2) >= 1
    source_names_q2 = [c["document_name"] for c in chunks_q2]
    assert "Password Help Article" in source_names_q2
