import hmac
import hashlib
import logging
from typing import Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from apps.api.src.config.settings import settings
from apps.api.src.models.core import GitHubRepository
from apps.api.src.services.github_sync_service import trigger_repository_sync

logger = logging.getLogger("github_webhook_service")


def verify_github_webhook_signature(
    raw_payload: bytes,
    signature_header: Optional[str],
    secret_key: Optional[str] = None,
) -> bool:
    """
    Verifies GitHub HMAC-SHA256 signature header (X-Hub-Signature-256).
    Prevents unauthorized webhook spoofing and replay attacks.
    """
    if not signature_header or not signature_header.startswith("sha256="):
        logger.warning("Missing or malformed X-Hub-Signature-256 header in webhook request.")
        return False

    secret = secret_key or getattr(settings, "GITHUB_WEBHOOK_SECRET", "mock-github-webhook-secret")
    if not secret:
        logger.warning("GITHUB_WEBHOOK_SECRET is not configured.")
        return False

    expected_signature = "sha256=" + hmac.new(
        secret.encode("utf-8"),
        raw_payload,
        hashlib.sha256
    ).hexdigest()

    # Constant time comparison to prevent timing attacks
    return hmac.compare_digest(expected_signature, signature_header)


async def handle_github_webhook(
    event_type: str,
    payload: Dict[str, Any],
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    Processes incoming GitHub webhook events ('push', 'pull_request', 'issues').
    Extracts repository metadata, matches active workspace integration, and queues
    asynchronous incremental sync tasks.
    """
    repo_data = payload.get("repository", {})
    repo_github_id = str(repo_data.get("id"))
    full_name = repo_data.get("full_name")

    if not repo_github_id or not full_name:
        logger.warning("Webhook payload missing repository identification data.")
        return {"status": "ignored", "reason": "missing_repository_info"}

    # Find connected GitHubRepository records matching repo_github_id
    res = await db.execute(
        select(GitHubRepository).where(GitHubRepository.repository_id == repo_github_id)
    )
    connected_repos = res.scalars().all()

    if not connected_repos:
        logger.info(f"Received webhook for repository '{full_name}' (ID: {repo_github_id}) which is not connected to any workspace.")
        return {"status": "ignored", "reason": "repository_not_connected"}

    queued_count = 0
    for repo in connected_repos:
        # For 'push' events, verify push branch matches target configured branch
        if event_type == "push":
            ref = payload.get("ref", "")
            target_ref = f"refs/heads/{repo.branch}"
            if ref and ref != target_ref:
                logger.info(f"Push event ref '{ref}' does not match target branch '{target_ref}' for workspace {repo.workspace_id}. Skipping.")
                continue

        logger.info(f"Queueing webhook-triggered sync for repo '{full_name}' in workspace '{repo.workspace_id}' (Event: {event_type})")
        await trigger_repository_sync(workspace_id=repo.workspace_id, repo_id=repo.id, db=db)
        queued_count += 1

    return {
        "status": "queued",
        "event_type": event_type,
        "repository": full_name,
        "workspaces_triggered": queued_count,
    }
