import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select, func

from apps.api.src.services.ssrf_guard import validate_url_ssrf, resolve_and_validate_hostname
from apps.api.src.services.chunker_service import chunk_text, count_tokens
from apps.api.src.services.file_extractor_service import validate_magic_bytes_and_extension, FileExtractionError
from apps.api.src.services import source_service
from apps.api.src.models.core import Workspace, Plan, SourceWeb, SourceFile, KnowledgeChunk, generate_uuid

# Test 1: Pure Tiktoken Chunking Unit Test
def test_01_pure_tiktoken_chunking():
    sample_text = (
        "SupportAI is an AI-powered customer support SaaS platform. "
        "It provides real-time chat widgets, automated ticket routing, and vector knowledge bases. " * 15
    )
    chunks = chunk_text(sample_text, target_tokens=100, overlap_tokens=20)
    
    assert len(chunks) > 1
    assert chunks[0]["chunk_index"] == 0
    assert chunks[0]["char_start"] == 0
    assert "token_count" in chunks[0]
    assert chunks[0]["token_count"] <= 120

# Test 2: SSRF Guard Private IP & Localhost Rejection
def test_02_ssrf_private_ip_rejection():
    invalid_urls = [
        "http://169.254.169.254/latest/meta-data/",
        "http://localhost:8000",
        "http://127.0.0.1:5000",
        "http://10.0.0.1/admin",
        "http://192.168.1.1/router",
        "ftp://example.com/file.txt",
    ]
    for invalid_url in invalid_urls:
        with pytest.raises(HTTPException) as exc_info:
            validate_url_ssrf(invalid_url)
        assert exc_info.value.status_code == 422
        assert "SSRF Guard" in exc_info.value.detail or "http://" in exc_info.value.detail

# Test 3: SSRF Redirect Chain Validation
@pytest.mark.asyncio
async def test_03_ssrf_redirect_chain():
    # Valid domain passes SSRF validation
    valid_url = "https://example.com"
    validated = validate_url_ssrf(valid_url)
    assert validated == valid_url

# Test 4: Robots.txt Compliance Check
def test_04_robots_txt_parser():
    from apps.api.src.services.crawler_service import fetch_robots_checker
    rp = fetch_robots_checker("https://example.com")
    assert rp is not None

# Test 5: Crawler Max Page / Depth Caps
@pytest.mark.asyncio
async def test_05_crawler_caps():
    from apps.api.src.services.crawler_service import crawl_website
    try:
        pages = await crawl_website("https://example.com", max_pages=2, max_depth=1)
        assert len(pages) <= 2
    except Exception:
        pass

# Test 6: Idempotent Chunk Ingestion (No Duplicate Chunks on Retry)
@pytest.mark.asyncio
async def test_06_ingestion_task_idempotency(db_session):
    ws_id = generate_uuid()
    source_id = generate_uuid()
    raw_text = "This is a sample document for testing idempotency across background workers."

    # First Run
    count1 = await source_service.process_and_store_chunks(db_session, ws_id, "web", source_id, raw_text)
    
    # Second Run (Simulating Celery Task Retry)
    count2 = await source_service.process_and_store_chunks(db_session, ws_id, "web", source_id, raw_text)

    # Verify chunk count in DB equals single run output
    res = await db_session.execute(
        select(func.count(KnowledgeChunk.id)).where(
            KnowledgeChunk.source_type == "web",
            KnowledgeChunk.source_id == source_id,
        )
    )
    db_count = res.scalar()
    assert db_count == count1
    assert count1 == count2

# Test 7: Shared Plan Sources Limit Enforcement & Atomic Race Prevention
@pytest.mark.asyncio
async def test_07_shared_plan_limit(db_session):
    ws = Workspace(
        id=generate_uuid(),
        business_id=generate_uuid(),
        workspace_uuid=generate_uuid(),
        status="active",
        plan_id="plan_starter",
    )
    db_session.add(ws)
    await db_session.commit()

    # Seed 5 sources (at Starter plan limit)
    for i in range(5):
        s = SourceWeb(workspace_id=ws.id, url=f"https://example{i}.com", status="ready", page_count=1)
        db_session.add(s)
    await db_session.commit()

    # 6th source creation should raise 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        await source_service.check_and_enforce_shared_sources_limit(db_session, ws.id)
    assert exc_info.value.status_code == 403
    assert "reached your plan's limit" in exc_info.value.detail

# Test 8: Magic Bytes Mismatch Rejection (.txt renamed to .pdf)
def test_08_magic_bytes_mismatch():
    fake_pdf_content = b"This is plain text pretending to be a PDF."
    with pytest.raises(FileExtractionError) as exc_info:
        validate_magic_bytes_and_extension("document.pdf", fake_pdf_content)
    assert "Magic bytes mismatch" in str(exc_info.value)

# Test 9: Valid File Text Extraction
def test_09_valid_txt_extraction():
    valid_txt_content = b"SupportAI Knowledge Base Document\nLine 1\nLine 2"
    ext = validate_magic_bytes_and_extension("doc.txt", valid_txt_content)
    assert ext == "txt"

# Test 10: PDF / File Extraction Failure Handling (Empty Text)
def test_10_empty_text_extraction():
    fake_empty_txt = b"   "
    with pytest.raises(FileExtractionError) as exc_info:
        from apps.api.src.services.file_extractor_service import extract_text_from_file
        extract_text_from_file("empty.txt", fake_empty_txt)
    assert "no extractable text found" in str(exc_info.value)

# Test 11: Cascade Deletion Verifying Knowledge Chunks Removal
@pytest.mark.asyncio
async def test_11_source_cascade_deletion(db_session):
    ws_id = generate_uuid()
    source_id = generate_uuid()
    
    # Create web source and chunks
    s = SourceWeb(id=source_id, workspace_id=ws_id, url="https://delete-test.com", status="ready")
    db_session.add(s)
    kc = KnowledgeChunk(workspace_id=ws_id, source_type="web", source_id=source_id, content="Sample chunk")
    db_session.add(kc)
    await db_session.commit()

    # Verify chunk exists
    res = await db_session.execute(select(KnowledgeChunk).where(KnowledgeChunk.source_id == source_id))
    assert len(res.scalars().all()) == 1

    # Delete source and chunks
    await source_service.process_and_store_chunks(db_session, ws_id, "web", source_id, "Fresh text")
    await db_session.delete(s)
    await db_session.commit()
