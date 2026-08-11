from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Header, status
from pydantic import BaseModel, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, text

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import get_current_user, get_current_workspace_member
from apps.api.src.models.core import User, TeamMember, SourceWeb, SourceFile, KnowledgeChunk
from apps.api.src.services import source_service

router = APIRouter(prefix="/sources", tags=["sources"])

class WebSourceCreate(BaseModel):
    url: str

class WebSourceResponse(BaseModel):
    id: str
    workspace_id: str
    url: str
    status: str
    page_count: int
    last_crawled_at: Optional[str] = None
    error_message: Optional[str] = None

class FileSourceResponse(BaseModel):
    id: str
    workspace_id: str
    filename: str
    file_size_bytes: int
    cloudinary_url: str
    status: str
    error_message: Optional[str] = None

@router.post("/web", response_model=WebSourceResponse)
async def create_web_source(
    payload: WebSourceCreate,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    import asyncio
    from apps.api.src.services.cache_service import invalidate_cache
    invalidate_cache(f"supportai:cache:{member.workspace_id}:sources_web")

    source = await source_service.create_web_source_pending(
        db, workspace_id=member.workspace_id, url=payload.url
    )

    # Always run in-process background task for immediate ingestion, fallback if Celery is not active
    asyncio.create_task(
        source_service.ingest_web_source_background(member.workspace_id, source.id, source.url)
    )
    try:
        from apps.api.src.celery_app import ingest_web_source_task
        ingest_web_source_task.apply_async(args=(source.id, member.workspace_id, source.url), expires=60)
    except Exception:
        pass

    return WebSourceResponse(
        id=source.id,
        workspace_id=source.workspace_id,
        url=source.url,
        status=source.status,
        page_count=source.page_count,
        last_crawled_at=source.last_crawled_at.isoformat() if source.last_crawled_at else None,
        error_message=getattr(source, "error_message", None),
    )

@router.get("/web", response_model=List[WebSourceResponse])
async def list_web_sources(
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    from apps.api.src.services.cache_service import get_cache, set_cache
    cache_key = f"supportai:cache:{member.workspace_id}:sources_web"
    cached = get_cache(cache_key)
    if cached:
        return [WebSourceResponse(**item) for item in cached]

    res = await db.execute(select(SourceWeb).where(SourceWeb.workspace_id == member.workspace_id))
    sources = res.scalars().all()
    resp = [
        WebSourceResponse(
            id=s.id,
            workspace_id=s.workspace_id,
            url=s.url,
            status=s.status,
            page_count=s.page_count,
            last_crawled_at=s.last_crawled_at.isoformat() if s.last_crawled_at else None,
            error_message=getattr(s, "error_message", None),
        )
        for s in sources
    ]
    set_cache(cache_key, [item.model_dump() for item in resp], ttl_seconds=10)
    return resp

@router.delete("/web/{source_id}")
async def delete_web_source(
    source_id: str,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    from apps.api.src.services.cache_service import invalidate_cache
    invalidate_cache(f"supportai:cache:{member.workspace_id}:sources_web")

    res = await db.execute(
        select(SourceWeb).where(SourceWeb.id == source_id, SourceWeb.workspace_id == member.workspace_id)
    )
    source = res.scalars().first()
    if not source:
        raise HTTPException(status_code=404, detail="Web source not found")

    # Cascade delete knowledge_chunks
    await db.execute(
        delete(KnowledgeChunk).where(KnowledgeChunk.source_type == "web", KnowledgeChunk.source_id == source_id)
    )
    await db.delete(source)
    await db.commit()
    return {"message": "Web source and associated vectors deleted successfully"}

@router.post("/web/{source_id}/recrawl", response_model=WebSourceResponse)
async def recrawl_web_source(
    source_id: str,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    import asyncio
    from apps.api.src.services.cache_service import invalidate_cache
    invalidate_cache(f"supportai:cache:{member.workspace_id}:sources_web")

    res = await db.execute(
        select(SourceWeb).where(SourceWeb.id == source_id, SourceWeb.workspace_id == member.workspace_id)
    )
    source = res.scalars().first()
    if not source:
        raise HTTPException(status_code=404, detail="Web source not found")

    source.status = "pending"
    await db.commit()

    asyncio.create_task(
        source_service.ingest_web_source_background(member.workspace_id, source.id, source.url)
    )

    return WebSourceResponse(
        id=source.id,
        workspace_id=source.workspace_id,
        url=source.url,
        status=source.status,
        page_count=source.page_count,
        last_crawled_at=source.last_crawled_at.isoformat() if source.last_crawled_at else None,
        error_message=getattr(source, "error_message", None),
    )

@router.post("/files", response_model=FileSourceResponse)
async def create_file_source(
    file: UploadFile = File(...),
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    import asyncio
    from apps.api.src.services.cache_service import invalidate_cache
    invalidate_cache(f"supportai:cache:{member.workspace_id}:sources_files")

    content_bytes = await file.read()
    try:
        source, extracted_text = await source_service.create_file_source_pending(
            db, workspace_id=member.workspace_id, filename=file.filename, content_bytes=content_bytes
        )
        asyncio.create_task(
            source_service.ingest_file_source_background(member.workspace_id, source.id, extracted_text)
        )
        try:
            from apps.api.src.celery_app import ingest_file_source_task
            ingest_file_source_task.apply_async(args=(source.id, member.workspace_id, extracted_text), expires=60)
        except Exception:
            pass
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return FileSourceResponse(
        id=source.id,
        workspace_id=source.workspace_id,
        filename=source.filename,
        file_size_bytes=source.file_size_bytes,
        cloudinary_url=getattr(source, "cloudinary_url", "") or "",
        status=source.status,
        error_message=getattr(source, "error_message", None),
    )

@router.get("/files", response_model=List[FileSourceResponse])
async def list_file_sources(
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    from apps.api.src.services.cache_service import get_cache, set_cache
    cache_key = f"supportai:cache:{member.workspace_id}:sources_files"
    cached = get_cache(cache_key)
    if cached:
        return [FileSourceResponse(**item) for item in cached]

    res = await db.execute(select(SourceFile).where(SourceFile.workspace_id == member.workspace_id))
    sources = res.scalars().all()
    resp = [
        FileSourceResponse(
            id=s.id,
            workspace_id=s.workspace_id,
            filename=s.filename,
            file_size_bytes=s.file_size_bytes,
            cloudinary_url=getattr(s, "cloudinary_url", "") or "",
            status=s.status,
            error_message=getattr(s, "error_message", None),
        )
        for s in sources
    ]
    set_cache(cache_key, [item.model_dump() for item in resp], ttl_seconds=10)
    return resp

@router.delete("/files/{source_id}")
async def delete_file_source(
    source_id: str,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    from apps.api.src.services.cache_service import invalidate_cache
    invalidate_cache(f"supportai:cache:{member.workspace_id}:sources_files")

    res = await db.execute(
        select(SourceFile).where(SourceFile.id == source_id, SourceFile.workspace_id == member.workspace_id)
    )
    source = res.scalars().first()
    if not source:
        raise HTTPException(status_code=404, detail="File source not found")

    await db.execute(
        delete(KnowledgeChunk).where(KnowledgeChunk.source_type == "file", KnowledgeChunk.source_id == source_id)
    )
    await db.delete(source)
    await db.commit()
    return {"message": "File source and associated vectors deleted successfully"}
