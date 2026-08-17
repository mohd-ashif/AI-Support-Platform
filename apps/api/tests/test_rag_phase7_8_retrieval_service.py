import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select

from apps.api.src.database.session import Base
from apps.api.src.models.core import User, Business, Workspace, KnowledgeSource, KnowledgeDocument, KnowledgeChunk
from apps.api.src.services.retrieval_service import RetrievalService, get_retrieval_service
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

@pytest.mark.asyncio
async def test_01_retrieval_requires_workspace_id(test_db: AsyncSession):
    svc = RetrievalService()
    with pytest.raises(ValueError) as exc_info:
        await svc.retrieve_relevant_knowledge(workspace_id="", query="Refund policy?", db=test_db)
    assert "workspace_id is required" in str(exc_info.value)

@pytest.mark.asyncio
async def test_02_tenant_isolated_retrieval_with_metadata(test_db: AsyncSession):
    # Setup Tenant 1 (Workspace Alpha) and Tenant 2 (Workspace Beta)
    u1 = User(email="alpha@example.com", name="Alpha Owner")
    u2 = User(email="beta@example.com", name="Beta Owner")
    test_db.add_all([u1, u2])
    await test_db.flush()

    b1 = Business(name="Alpha Corp", owner_user_id=u1.id)
    b2 = Business(name="Beta Corp", owner_user_id=u2.id)
    test_db.add_all([b1, b2])
    await test_db.flush()

    ws_alpha = Workspace(business_id=b1.id)
    ws_beta = Workspace(business_id=b2.id)
    test_db.add_all([ws_alpha, ws_beta])
    await test_db.flush()

    # Add KnowledgeChunk for Alpha
    chunk_alpha = KnowledgeChunk(
        workspace_id=ws_alpha.id,
        source_type="file",
        source_id="src_alpha",
        document_id="doc_alpha",
        content="Alpha Corp refund period is 60 days.",
        token_count=8,
        metadata_json={
            "document_name": "Alpha Terms.pdf",
            "page_number": 3,
            "section": "Refund Terms",
            "url": "https://alpha.com/terms",
        },
    )

    # Add KnowledgeChunk for Beta
    chunk_beta = KnowledgeChunk(
        workspace_id=ws_beta.id,
        source_type="file",
        source_id="src_beta",
        document_id="doc_beta",
        content="Beta Corp refund period is 14 days.",
        token_count=8,
        metadata_json={
            "document_name": "Beta Terms.pdf",
            "page_number": 1,
            "section": "Returns",
            "url": "https://beta.com/terms",
        },
    )

    test_db.add_all([chunk_alpha, chunk_beta])
    await test_db.commit()

    # Mock embedding service for offline test execution
    mock_embed = EmbeddingService()
    mock_embed._is_mock_enabled = lambda: True
    svc = RetrievalService(embedding_service=mock_embed)

    # Query for Alpha workspace
    chunks_a, conf_a = await svc.retrieve_relevant_knowledge(
        workspace_id=ws_alpha.id,
        query="What is the refund period?",
        db=test_db,
    )
    assert len(chunks_a) >= 1
    assert chunks_a[0]["document_name"] == "Alpha Terms.pdf"
    assert chunks_a[0]["page_number"] == 3
    assert "Alpha Corp refund period is 60 days" in chunks_a[0]["content"]

    # Query for Beta workspace
    chunks_b, conf_b = await svc.retrieve_relevant_knowledge(
        workspace_id=ws_beta.id,
        query="What is the refund period?",
        db=test_db,
    )
    assert len(chunks_b) >= 1
    assert chunks_b[0]["document_name"] == "Beta Terms.pdf"
    assert "Beta Corp refund period is 14 days" in chunks_b[0]["content"]
    assert "Alpha Corp" not in chunks_b[0]["content"]
