import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select

from apps.api.src.database.session import Base
from apps.api.src.models.core import User, Business, Workspace, KnowledgeSource, KnowledgeDocument, KnowledgeChunk
from apps.api.src.services.ingestion_service import create_knowledge_source_ingestion

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
async def test_01_fast_return_and_background_ingestion(test_db: AsyncSession):
    # Setup test workspace
    user = User(email="ingest_test@example.com", name="Ingest Test Owner")
    test_db.add(user)
    await test_db.flush()

    business = Business(name="Ingest Corp", owner_user_id=user.id)
    test_db.add(business)
    await test_db.flush()

    workspace = Workspace(business_id=business.id)
    test_db.add(workspace)
    await test_db.flush()

    # Test Generic Source Ingestion (FAQ)
    result = await create_knowledge_source_ingestion(
        db=test_db,
        workspace_id=workspace.id,
        source_type="FAQ",
        name="Security Policy FAQ",
        content_raw="Q: Is data encrypted?\nA: Yes, all data is encrypted in transit using TLS 1.3 and at rest with AES-256.",
    )

    assert result["status"] == "processing"
    assert "sourceId" in result
    assert "documentId" in result

    # Verify DB records created immediately
    res_s = await test_db.execute(select(KnowledgeSource).where(KnowledgeSource.id == result["sourceId"]))
    source = res_s.scalars().first()
    assert source is not None
    assert source.type == "FAQ"
    assert source.workspace_id == workspace.id

    res_d = await test_db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == result["documentId"]))
    doc = res_d.scalars().first()
    assert doc is not None
    assert "encrypted" in doc.content_raw
