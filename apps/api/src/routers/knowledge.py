from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import get_current_workspace_member
from apps.api.src.models.core import TeamMember, KnowledgeSource, KnowledgeDocument, DocumentVersion, KnowledgeChunk
from apps.api.src.services.ingestion_service import create_knowledge_source_ingestion

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

class GenericKnowledgeSourceCreate(BaseModel):
    type: str = Field(..., description="Source type: URL, FAQ, ARTICLE, CSV, MARKDOWN")
    name: str = Field(..., description="Title/Name of the knowledge source")
    content: Optional[str] = Field(None, description="Raw content for FAQ, ARTICLE, CSV, MARKDOWN")
    url: Optional[str] = Field(None, description="Target URL for website crawler source")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict)

class KnowledgeSourceResponse(BaseModel):
    id: str
    workspace_id: str
    type: str
    name: str
    status: str
    metadata: Dict[str, Any] = Field(default_factory=dict)
    created_at: str
    updated_at: str

@router.post("/documents")
async def upload_and_ingest_document(
    file: UploadFile = File(...),
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    """
    POST /knowledge/documents
    Accepts file upload, validates, creates processing job, and returns quickly to frontend.
    """
    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Uploaded file is empty.")

    result = await create_knowledge_source_ingestion(
        db=db,
        workspace_id=member.workspace_id,
        source_type="FILE",
        name=file.filename or "Uploaded Document",
        filename=file.filename,
        file_bytes=file_bytes,
    )
    return result

@router.post("/sources")
async def create_knowledge_source(
    payload: GenericKnowledgeSourceCreate,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    """
    POST /knowledge/sources
    Creates URL, FAQ, ARTICLE, CSV, or MARKDOWN knowledge source and triggers background processing.
    """
    result = await create_knowledge_source_ingestion(
        db=db,
        workspace_id=member.workspace_id,
        source_type=payload.type,
        name=payload.name,
        content_raw=payload.content,
        url=payload.url,
        metadata=payload.metadata,
    )
    return result

@router.get("/sources", response_model=List[KnowledgeSourceResponse])
async def list_knowledge_sources(
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /knowledge/sources
    Returns all unified knowledge sources belonging strictly to the authenticated workspace.
    """
    res = await db.execute(
        select(KnowledgeSource)
        .where(KnowledgeSource.workspace_id == member.workspace_id)
        .order_by(KnowledgeSource.created_at.desc())
    )
    sources = res.scalars().all()
    return [
        KnowledgeSourceResponse(
            id=s.id,
            workspace_id=s.workspace_id,
            type=s.type,
            name=s.name,
            status=s.status,
            metadata=s.metadata_json or {},
            created_at=s.created_at.isoformat(),
            updated_at=s.updated_at.isoformat(),
        )
        for s in sources
    ]

@router.get("/search")
async def admin_knowledge_search(
    q: str,
    top_k: int = 5,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /knowledge/search?q={query}&top_k=5
    Admin Knowledge Search feature for validating RAG retrieval precision and scores.
    """
    if not q or not q.strip():
        return {"query": "", "results": []}

    from apps.api.src.services.retrieval_service import get_retrieval_service
    retrieval_svc = get_retrieval_service()
    chunks, max_conf = await retrieval_svc.retrieve_relevant_knowledge(
        workspace_id=member.workspace_id,
        query=q.strip(),
        db=db,
        top_k=top_k,
    )
    return {
        "query": q,
        "maxConfidence": max_conf,
        "results": chunks,
    }

@router.post("/sources/{source_id}/reindex")
async def reindex_knowledge_source(
    source_id: str,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    """
    POST /knowledge/sources/{source_id}/reindex
    Triggers re-indexing and embedding replacement for an existing knowledge source.
    """
    res = await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.id == source_id,
            KnowledgeSource.workspace_id == member.workspace_id,
        )
    )
    source = res.scalars().first()
    if not source:
        raise HTTPException(status_code=404, detail="Knowledge source not found.")

    res_doc = await db.execute(select(KnowledgeDocument).where(KnowledgeDocument.source_id == source.id))
    doc = res_doc.scalars().first()
    if not doc:
        raise HTTPException(status_code=404, detail="Associated document not found.")

    # Create new DocumentVersion
    res_v = await db.execute(select(DocumentVersion).where(DocumentVersion.document_id == doc.id))
    versions = res_v.scalars().all()
    next_ver_num = len(versions) + 1

    new_version = DocumentVersion(
        workspace_id=member.workspace_id,
        document_id=doc.id,
        version_number=next_ver_num,
        status="active",
    )
    db.add(new_version)
    source.status = "processing"
    await db.commit()
    await db.refresh(new_version)

    from apps.api.src.services.ingestion_service import ingest_knowledge_document_background
    import asyncio

    asyncio.create_task(
        ingest_knowledge_document_background(
            workspace_id=member.workspace_id,
            source_id=source.id,
            document_id=doc.id,
            version_id=new_version.id,
            source_type=source.type,
            raw_text=doc.content_raw or "",
            url=(source.metadata_json or {}).get("url"),
        )
    )

    return {"status": "processing", "message": f"Re-indexing started for version {next_ver_num}."}

@router.delete("/sources/{source_id}")
async def delete_knowledge_source(
    source_id: str,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    """
    DELETE /knowledge/sources/{source_id}
    Cascade deletes knowledge source, documents, versions, and vector chunks.
    """
    from apps.api.src.dependencies.rbac import has_role_permission, Permissions
    if not has_role_permission(member.role, Permissions.KNOWLEDGE_MANAGE):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied. Required permission '{Permissions.KNOWLEDGE_MANAGE}' missing for role '{member.role}'.",
        )

    res = await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.id == source_id,
            KnowledgeSource.workspace_id == member.workspace_id,
        )
    )
    source = res.scalars().first()
    if not source:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Knowledge source not found.")

    # Cascade delete chunks, versions, documents, and source
    await db.execute(delete(KnowledgeChunk).where(KnowledgeChunk.source_id == source_id, KnowledgeChunk.workspace_id == member.workspace_id))
    await db.execute(delete(DocumentVersion).where(DocumentVersion.workspace_id == member.workspace_id))
    await db.execute(delete(KnowledgeDocument).where(KnowledgeDocument.source_id == source_id, KnowledgeDocument.workspace_id == member.workspace_id))
    await db.delete(source)
    await db.commit()

    return {"message": "Knowledge source and associated vectors deleted successfully."}
