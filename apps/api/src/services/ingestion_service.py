import asyncio
import logging
from typing import Dict, Any, Optional, Tuple
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from apps.api.src.models.core import (
    Workspace,
    KnowledgeSource,
    KnowledgeDocument,
    DocumentVersion,
    KnowledgeChunk,
    utc_now,
)
from apps.api.src.services.source_service import check_and_enforce_shared_sources_limit
from apps.api.src.services.ssrf_guard import validate_url_ssrf
from apps.api.src.services.file_extractor_service import extract_text_from_file
from apps.api.src.services.chunker_service import chunk_text
from apps.api.src.services.embedding_service import generate_embeddings_for_chunks
from apps.api.src.services.cloudinary_service import upload_file_to_cloudinary
from apps.api.src.services.crawler_service import crawl_website

logger = logging.getLogger("ingestion_service")

async def create_knowledge_source_ingestion(
    db: AsyncSession,
    workspace_id: str,
    source_type: str, # FILE, URL, FAQ, ARTICLE, CSV, MARKDOWN
    name: str,
    content_raw: Optional[str] = None,
    filename: Optional[str] = None,
    file_bytes: Optional[bytes] = None,
    url: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Unified Ingestion Entry Point.
    Creates KnowledgeSource, KnowledgeDocument, and DocumentVersion,
    returns fast response to caller, and dispatches background processing worker.
    """
    source_type_upper = source_type.upper()
    valid_types = {"FILE", "URL", "FAQ", "ARTICLE", "CSV", "MARKDOWN"}
    if source_type_upper not in valid_types:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported source type '{source_type}'. Allowed types: {sorted(list(valid_types))}",
        )

    # Enforce workspace source limit
    await check_and_enforce_shared_sources_limit(db, workspace_id)

    meta = metadata.copy() if metadata else {}
    cloudinary_url = None

    # Source specific pre-checks
    if source_type_upper == "URL":
        if not url:
            raise HTTPException(status_code=400, detail="URL is required for URL source type.")
        validated_url = validate_url_ssrf(url)
        meta["url"] = validated_url
        name = name or validated_url

    elif source_type_upper == "FILE":
        if not filename or not file_bytes:
            raise HTTPException(status_code=400, detail="Filename and file content are required for FILE source type.")
        extracted_text, file_size = extract_text_from_file(filename, file_bytes)
        content_raw = extracted_text
        meta["file_size_bytes"] = file_size
        meta["filename"] = filename
        cloudinary_url = await upload_file_to_cloudinary(filename, file_bytes, folder="knowledge-sources")
        meta["cloudinary_url"] = cloudinary_url

    # Create KnowledgeSource record
    source = KnowledgeSource(
        workspace_id=workspace_id,
        type=source_type_upper,
        name=name,
        status="processing",
        metadata_json=meta,
    )
    db.add(source)
    await db.flush()

    # Create KnowledgeDocument record
    document = KnowledgeDocument(
        workspace_id=workspace_id,
        source_id=source.id,
        title=name,
        content_raw=content_raw or "",
        content_clean=content_raw or "",
        metadata_json=meta,
    )
    db.add(document)
    await db.flush()

    # Create initial DocumentVersion record
    doc_version = DocumentVersion(
        workspace_id=workspace_id,
        document_id=document.id,
        version_number=1,
        status="active",
    )
    db.add(doc_version)
    await db.commit()
    await db.refresh(source)
    await db.refresh(document)
    await db.refresh(doc_version)

    # Launch background worker for chunking & embedding
    asyncio.create_task(
        ingest_knowledge_document_background(
            workspace_id=workspace_id,
            source_id=source.id,
            document_id=document.id,
            version_id=doc_version.id,
            source_type=source_type_upper,
            raw_text=content_raw or "",
            url=meta.get("url"),
        )
    )

    try:
        from apps.api.src.celery_app import process_knowledge_document_task
        process_knowledge_document_task.apply_async(
            args=(source.id, document.id, doc_version.id, workspace_id, source_type_upper, content_raw or "", meta.get("url")),
            expires=120,
        )
    except Exception:
        pass

    return {
        "status": "processing",
        "sourceId": source.id,
        "documentId": document.id,
        "versionId": doc_version.id,
        "type": source.type,
        "name": source.name,
    }


async def ingest_knowledge_document_background(
    workspace_id: str,
    source_id: str,
    document_id: str,
    version_id: str,
    source_type: str,
    raw_text: str,
    url: Optional[str] = None,
) -> None:
    """
    Background worker function for asynchronous text extraction, cleaning, chunking,
    embedding generation, and vector insertion.
    """
    from apps.api.src.database.session import AsyncSessionLocal

    try:
        # Step 1: If URL source, execute website crawl to get fresh text
        if source_type == "URL" and url:
            crawled_pages = await crawl_website(url)
            raw_text = "\n\n".join([f"=== Document: {p['title']} ({p['url']}) ===\n{p['text']}" for p in crawled_pages])

        # Step 2: Normalize & Clean Text
        from apps.api.src.services.normalizer_service import normalize_text, extract_chunk_metadata
        clean_text_content = normalize_text(raw_text)

        # Step 3: Chunk Text
        chunks_raw = chunk_text(clean_text_content, target_tokens=250, overlap_tokens=30)
        if not chunks_raw:
            chunks_raw = [{
                "chunk_index": 0,
                "content": clean_text_content or "Empty document",
                "token_count": len((clean_text_content or "").split()),
            }]

        # Fetch source details for document_name metadata
        source_name = "Document"
        async with AsyncSessionLocal() as db:
            res_s = await db.execute(select(KnowledgeSource).where(KnowledgeSource.id == source_id))
            src = res_s.scalars().first()
            if src:
                src.status = "indexing"
                source_name = src.name
                await db.commit()

        # Step 4: Embed Chunks
        chunks_with_embeddings = generate_embeddings_for_chunks(chunks_raw)

        # Step 5: Write Vectors with Metadata to DB & update status to READY
        async with AsyncSessionLocal() as db:
            # Delete existing chunks for this document version
            await db.execute(
                delete(KnowledgeChunk).where(
                    KnowledgeChunk.workspace_id == workspace_id,
                    KnowledgeChunk.document_id == document_id,
                )
            )

            for item in chunks_with_embeddings:
                chunk_meta = extract_chunk_metadata(
                    chunk_text=item["content"],
                    workspace_id=workspace_id,
                    document_id=document_id,
                    source_type=source_type,
                    document_name=source_name,
                    url=url,
                )
                kc = KnowledgeChunk(
                    workspace_id=workspace_id,
                    source_type=source_type.lower(),
                    source_id=source_id,
                    document_id=document_id,
                    version_id=version_id,
                    chunk_index=item.get("chunk_index", 0),
                    content=item["content"],
                    embedding=item.get("embedding"),
                    token_count=item["token_count"],
                    metadata_json=chunk_meta,
                )
                db.add(kc)

            # Update Document Version & Source status
            res_v = await db.execute(select(DocumentVersion).where(DocumentVersion.id == version_id))
            ver = res_v.scalars().first()
            if ver:
                ver.indexed_at = utc_now()
                ver.status = "active"

            res_s = await db.execute(select(KnowledgeSource).where(KnowledgeSource.id == source_id))
            src = res_s.scalars().first()
            if src:
                src.status = "ready"
                src.updated_at = utc_now()

            await db.commit()
            logger.info(f"Successfully processed and indexed {len(chunks_with_embeddings)} chunks for document {document_id}")

    except Exception as e:
        logger.error(f"Ingestion worker failed for source {source_id}: {e}", exc_info=True)
        try:
            async with AsyncSessionLocal() as db:
                res_s = await db.execute(select(KnowledgeSource).where(KnowledgeSource.id == source_id))
                src = res_s.scalars().first()
                if src:
                    src.status = "failed"
                    src.metadata_json = dict(src.metadata_json or {}, error=str(e))
                    await db.commit()
        except Exception:
            pass
