import logging
from typing import List, Dict, Any, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, delete

from apps.api.src.models.core import (
    Workspace,
    Plan,
    SourceWeb,
    SourceFile,
    KnowledgeChunk,
    TeamMember,
    generate_uuid,
    utc_now,
)
from apps.api.src.services.ssrf_guard import validate_url_ssrf
from apps.api.src.services.crawler_service import crawl_website
from apps.api.src.services.file_extractor_service import extract_text_from_file
from apps.api.src.services.chunker_service import chunk_text
from apps.api.src.services.embedding_service import generate_embeddings_for_chunks

logger = logging.getLogger("source_service")

async def check_and_enforce_shared_sources_limit(db: AsyncSession, workspace_id: str) -> None:
    ws_res = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
    ws = ws_res.scalars().first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    limit = 5  # Default MVP limit fallback
    if ws.plan_id:
        plan_res = await db.execute(select(Plan).where(Plan.id == ws.plan_id))
        plan = plan_res.scalars().first()
        if plan and plan.features_json and "sources_limit" in plan.features_json:
            limit = plan.features_json["sources_limit"]

    # -1 Sentinel represents Unlimited (Business plan)
    if limit == -1:
        return

    # Count combined Web + File sources
    web_count_res = await db.execute(
        select(func.count(SourceWeb.id)).where(
            SourceWeb.workspace_id == workspace_id,
            SourceWeb.status != "failed",
        )
    )
    web_count = web_count_res.scalar() or 0

    file_count_res = await db.execute(
        select(func.count(SourceFile.id)).where(
            SourceFile.workspace_id == workspace_id,
            SourceFile.status != "failed",
        )
    )
    file_count = file_count_res.scalar() or 0

    total_sources = web_count + file_count
    if total_sources >= limit:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"You've reached your plan's limit of {limit} sources. Current usage: {total_sources} / {limit}. Upgrade your subscription plan to add more sources.",
        )

async def process_and_store_chunks(
    db: AsyncSession,
    workspace_id: str,
    source_type: str,
    source_id: str,
    raw_text: str,
) -> int:
    # Pure tiktoken chunking with fine-grained 250 token target & 30 overlap
    chunks_raw = chunk_text(raw_text, target_tokens=250, overlap_tokens=30)
    if not chunks_raw:
        raise Exception("no extractable text found")

    # Generate batch embeddings
    chunks_with_embeddings = generate_embeddings_for_chunks(chunks_raw)

    # Step 5: Idempotent writes - DELETE existing chunks before inserting
    await db.execute(
        delete(KnowledgeChunk).where(
            KnowledgeChunk.source_type == source_type,
            KnowledgeChunk.source_id == source_id,
        )
    )

    # Insert fresh chunks
    for item in chunks_with_embeddings:
        kc = KnowledgeChunk(
            workspace_id=workspace_id,
            source_type=source_type,
            source_id=source_id,
            content=item["content"],
            embedding=item.get("embedding"),
            token_count=item["token_count"],
        )
        db.add(kc)

    await db.flush()
    return len(chunks_with_embeddings)

async def create_web_source_pending(
    db: AsyncSession,
    workspace_id: str,
    url: str,
) -> SourceWeb:
    # Step 1: SSRF check
    validated_url = validate_url_ssrf(url)
    
    # Step 6: Plan Limit check
    await check_and_enforce_shared_sources_limit(db, workspace_id)

    source = SourceWeb(
        workspace_id=workspace_id,
        url=validated_url,
        status="pending",
        page_count=0,
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return source

async def ingest_web_source_background(
    workspace_id: str,
    source_id: str,
    url: str,
) -> None:
    from apps.api.src.database.session import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(SourceWeb).where(SourceWeb.id == source_id))
            source = res.scalars().first()
            if not source:
                return
            source.status = "crawling"
            await db.commit()

        crawled_pages = await crawl_website(url)
        combined_text = "\n\n".join([f"=== Document: {p['title']} ({p['url']}) ===\n{p['text']}" for p in crawled_pages])

        chunks_raw = chunk_text(combined_text, target_tokens=250, overlap_tokens=30)
        chunks_with_embeddings = generate_embeddings_for_chunks(chunks_raw) if chunks_raw else []

        async with AsyncSessionLocal() as db:
            await db.execute(
                delete(KnowledgeChunk).where(
                    KnowledgeChunk.source_type == "web",
                    KnowledgeChunk.source_id == source_id,
                )
            )
            for item in chunks_with_embeddings:
                kc = KnowledgeChunk(
                    workspace_id=workspace_id,
                    source_type="web",
                    source_id=source_id,
                    content=item["content"],
                    embedding=item.get("embedding"),
                    token_count=item["token_count"],
                )
                db.add(kc)

            res = await db.execute(select(SourceWeb).where(SourceWeb.id == source_id))
            source = res.scalars().first()
            if source:
                source.status = "ready"
                source.page_count = len(crawled_pages)
                source.last_crawled_at = utc_now()
                source.error_message = None
            await db.commit()
    except Exception as e:
        logger.error(f"Web crawl failed for source {source_id}: {e}")
        try:
            async with AsyncSessionLocal() as db:
                res = await db.execute(select(SourceWeb).where(SourceWeb.id == source_id))
                source = res.scalars().first()
                if source:
                    source.status = "failed"
                    source.error_message = str(e)
                    await db.commit()
        except Exception:
            pass

async def create_file_source_pending(
    db: AsyncSession,
    workspace_id: str,
    filename: str,
    content_bytes: bytes,
    cloudinary_url: str = None,
) -> Tuple[SourceFile, str]:
    from apps.api.src.services.cloudinary_service import upload_file_to_cloudinary

    extracted_text, file_size = extract_text_from_file(filename, content_bytes)

    if not cloudinary_url:
        cloudinary_url = await upload_file_to_cloudinary(filename, content_bytes, folder="knowledge-sources")

    await check_and_enforce_shared_sources_limit(db, workspace_id)

    source = SourceFile(
        workspace_id=workspace_id,
        filename=filename,
        file_size_bytes=file_size,
        cloudinary_url=cloudinary_url,
        storage_url=cloudinary_url,
        status="pending",
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return source, extracted_text

async def ingest_file_source_background(
    workspace_id: str,
    source_id: str,
    extracted_text: str,
) -> None:
    from apps.api.src.database.session import AsyncSessionLocal

    try:
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(SourceFile).where(SourceFile.id == source_id))
            source = res.scalars().first()
            if not source:
                return
            source.status = "processing"
            await db.commit()

        chunks_raw = chunk_text(extracted_text, target_tokens=250, overlap_tokens=30)
        chunks_with_embeddings = generate_embeddings_for_chunks(chunks_raw) if chunks_raw else []

        async with AsyncSessionLocal() as db:
            await db.execute(
                delete(KnowledgeChunk).where(
                    KnowledgeChunk.source_type == "file",
                    KnowledgeChunk.source_id == source_id,
                )
            )
            for item in chunks_with_embeddings:
                kc = KnowledgeChunk(
                    workspace_id=workspace_id,
                    source_type="file",
                    source_id=source_id,
                    content=item["content"],
                    embedding=item.get("embedding"),
                    token_count=item["token_count"],
                )
                db.add(kc)

            res = await db.execute(select(SourceFile).where(SourceFile.id == source_id))
            source = res.scalars().first()
            if source:
                source.status = "ready"
                source.error_message = None
            await db.commit()
    except Exception as e:
        logger.error(f"File ingestion failed for source {source_id}: {e}")
        try:
            async with AsyncSessionLocal() as db:
                res = await db.execute(select(SourceFile).where(SourceFile.id == source_id))
                source = res.scalars().first()
                if source:
                    source.status = "failed"
                    source.error_message = str(e)
                    await db.commit()
        except Exception:
            pass
