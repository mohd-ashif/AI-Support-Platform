import logging
from typing import Dict, Any
from fastapi import APIRouter, Request, HTTPException, status
from apps.api.src.services.qstash_service import qstash_service

logger = logging.getLogger("jobs_router")

router = APIRouter(prefix="/api/v1/jobs", tags=["Background Jobs"])

async def execute_background_job(job_type: str, payload: Dict[str, Any]):
    """
    Executes the actual task logic associated with job_type.
    """
    logger.info(f"[BACKGROUND-JOB-RUNNER] Starting execution of job_type='{job_type}' with payload keys: {list(payload.keys())}")
    try:
        if job_type == "ingest_web_source":
            source_id = payload.get("source_id")
            url = payload.get("url")
            workspace_id = payload.get("workspace_id")
            from apps.api.src.services.crawler_service import crawl_and_embed_domain
            await crawl_and_embed_domain(source_id=source_id, url=url, workspace_id=workspace_id)

        elif job_type == "ingest_file_source":
            source_id = payload.get("source_id")
            file_url = payload.get("file_url")
            filename = payload.get("filename")
            workspace_id = payload.get("workspace_id")
            from apps.api.src.services.file_extractor_service import process_file_source
            await process_file_source(source_id=source_id, file_url=file_url, filename=filename, workspace_id=workspace_id)

        elif job_type == "process_knowledge_document":
            source_id = payload.get("source_id")
            document_id = payload.get("document_id")
            workspace_id = payload.get("workspace_id")
            from apps.api.src.services.ingestion_service import process_knowledge_document
            await process_knowledge_document(source_id=source_id, document_id=document_id, workspace_id=workspace_id)

        elif job_type == "sync_github_repository":
            repo_id = payload.get("repo_id")
            workspace_id = payload.get("workspace_id")
            from apps.api.src.services.github_sync_service import sync_github_repository
            await sync_github_repository(repo_id=repo_id, workspace_id=workspace_id)

        elif job_type == "sync_github_issues":
            repo_id = payload.get("repo_id")
            workspace_id = payload.get("workspace_id")
            from apps.api.src.services.github_issue_pr_service import sync_github_issues_and_prs
            await sync_github_issues_and_prs(repo_id=repo_id, workspace_id=workspace_id)

        elif job_type == "code_analysis":
            repo_id = payload.get("repo_id")
            file_path = payload.get("file_path")
            workspace_id = payload.get("workspace_id")
            from apps.api.src.services.code_explanation_service import generate_code_explanation
            await generate_code_explanation(repo_id=repo_id, file_path=file_path, workspace_id=workspace_id)

        else:
            logger.warning(f"[BACKGROUND-JOB-RUNNER] Unknown job_type='{job_type}' received.")

        logger.info(f"[BACKGROUND-JOB-RUNNER] Successfully completed execution of job_type='{job_type}'")
    except Exception as e:
        logger.error(f"[BACKGROUND-JOB-RUNNER] Error executing job_type='{job_type}': {e}", exc_info=True)
        raise

@router.post("/handle/{job_type}", status_code=status.HTTP_200_OK)
async def handle_job_callback(job_type: str, request: Request):
    """
    QStash webhook callback endpoint for background job execution.
    Verifies signature header and triggers job execution.
    """
    body = await request.body()
    headers = dict(request.headers)

    if not qstash_service.verify_signature(headers, body):
        logger.warning(f"[QSTASH-WEBHOOK] Unauthorized QStash signature for job_type='{job_type}'")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid QStash signature")

    payload = await request.json()
    await execute_background_job(job_type, payload)
    return {"status": "success", "job_type": job_type}
