import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import select

from apps.api.src.database.session import Base
from apps.api.src.models.core import (
    Workspace,
    Business,
    User,
    KnowledgeSource,
    KnowledgeDocument,
    DocumentVersion,
    KnowledgeChunk,
    generate_uuid,
)

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
async def test_01_create_unified_knowledge_source_and_document(test_db: AsyncSession):
    # Setup test User, Business, Workspace
    user = User(email="tenant1@example.com", name="Tenant 1 Owner")
    test_db.add(user)
    await test_db.flush()

    business = Business(name="Company A", owner_user_id=user.id)
    test_db.add(business)
    await test_db.flush()

    workspace = Workspace(business_id=business.id)
    test_db.add(workspace)
    await test_db.flush()

    # Create KnowledgeSource (Type: FILE, FAQ, URL, ARTICLE, CSV, MARKDOWN)
    source = KnowledgeSource(
        workspace_id=workspace.id,
        type="FILE",
        name="Company_A_Refund_Policy.pdf",
        status="ready",
        metadata_json={"mime_type": "application/pdf", "file_size_bytes": 102400},
    )
    test_db.add(source)
    await test_db.flush()

    # Create KnowledgeDocument
    doc = KnowledgeDocument(
        workspace_id=workspace.id,
        source_id=source.id,
        title="Refund Policy 2026",
        content_raw="Customers are entitled to a full refund within 30 days.",
        content_clean="Customers are entitled to a full refund within 30 days.",
        metadata_json={"author": "Legal Team", "pages": 2},
    )
    test_db.add(doc)
    await test_db.flush()

    # Create DocumentVersion
    doc_ver = DocumentVersion(
        workspace_id=workspace.id,
        document_id=doc.id,
        version_number=1,
        content_hash="hash_v1_12345",
        status="active",
    )
    test_db.add(doc_ver)
    await test_db.flush()

    # Create KnowledgeChunk linked to unified model
    chunk = KnowledgeChunk(
        workspace_id=workspace.id,
        source_type="source",
        source_id=source.id,
        document_id=doc.id,
        version_id=doc_ver.id,
        chunk_index=0,
        content="Customers are entitled to a full refund within 30 days.",
        token_count=12,
        metadata_json={
            "document_name": "Refund Policy 2026",
            "page_number": 1,
            "section": "Refund Terms",
        },
    )
    test_db.add(chunk)
    await test_db.commit()

    # Verify Persistence
    res = await test_db.execute(select(KnowledgeSource).where(KnowledgeSource.id == source.id))
    fetched_source = res.scalars().first()
    assert fetched_source is not None
    assert fetched_source.name == "Company_A_Refund_Policy.pdf"
    assert fetched_source.type == "FILE"
    assert fetched_source.workspace_id == workspace.id

    res_doc = await test_db.execute(select(KnowledgeDocument).where(KnowledgeDocument.id == doc.id))
    fetched_doc = res_doc.scalars().first()
    assert fetched_doc is not None
    assert fetched_doc.title == "Refund Policy 2026"

    res_chunk = await test_db.execute(select(KnowledgeChunk).where(KnowledgeChunk.id == chunk.id))
    fetched_chunk = res_chunk.scalars().first()
    assert fetched_chunk is not None
    assert fetched_chunk.document_id == doc.id
    assert fetched_chunk.metadata_json["page_number"] == 1

@pytest.mark.asyncio
async def test_02_tenant_isolation_knowledge_retrieval(test_db: AsyncSession):
    # Setup Tenant 1 (Company A) and Tenant 2 (Company B)
    u1 = User(email="ownerA@example.com", name="Owner A")
    u2 = User(email="ownerB@example.com", name="Owner B")
    test_db.add_all([u1, u2])
    await test_db.flush()

    b1 = Business(name="Company A", owner_user_id=u1.id)
    b2 = Business(name="Company B", owner_user_id=u2.id)
    test_db.add_all([b1, b2])
    await test_db.flush()

    ws_a = Workspace(business_id=b1.id)
    ws_b = Workspace(business_id=b2.id)
    test_db.add_all([ws_a, ws_b])
    await test_db.flush()

    # Company A Source & Chunk
    source_a = KnowledgeSource(workspace_id=ws_a.id, type="FAQ", name="Company A Secret Strategy", status="ready")
    test_db.add(source_a)
    await test_db.flush()

    chunk_a = KnowledgeChunk(
        workspace_id=ws_a.id,
        source_type="source",
        source_id=source_a.id,
        content="Company A secret password is BlueSky123.",
        token_count=7,
    )

    # Company B Source & Chunk
    source_b = KnowledgeSource(workspace_id=ws_b.id, type="ARTICLE", name="Company B Public Article", status="ready")
    test_db.add(source_b)
    await test_db.flush()

    chunk_b = KnowledgeChunk(
        workspace_id=ws_b.id,
        source_type="source",
        source_id=source_b.id,
        content="Company B public pricing is $99/mo.",
        token_count=6,
    )

    test_db.add_all([chunk_a, chunk_b])
    await test_db.commit()

    # Query strictly for Tenant A (ws_a)
    res_a = await test_db.execute(select(KnowledgeChunk).where(KnowledgeChunk.workspace_id == ws_a.id))
    chunks_a = res_a.scalars().all()
    assert len(chunks_a) == 1
    assert "BlueSky123" in chunks_a[0].content

    # Query strictly for Tenant B (ws_b)
    res_b = await test_db.execute(select(KnowledgeChunk).where(KnowledgeChunk.workspace_id == ws_b.id))
    chunks_b = res_b.scalars().all()
    assert len(chunks_b) == 1
    assert "$99/mo" in chunks_b[0].content

    # Verify cross-tenant isolation: Tenant B query CANNOT fetch Tenant A data
    res_cross = await test_db.execute(
        select(KnowledgeChunk).where(
            KnowledgeChunk.workspace_id == ws_b.id,
            KnowledgeChunk.content.contains("BlueSky123"),
        )
    )
    cross_results = res_cross.scalars().all()
    assert len(cross_results) == 0, "SECURITY BREAK: Tenant B retrieved Tenant A's private knowledge!"
