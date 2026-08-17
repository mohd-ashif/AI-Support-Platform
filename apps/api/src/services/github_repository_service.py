import logging
import httpx
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from fastapi import HTTPException, status

from apps.api.src.models.core import (
    GitHubRepository,
    GitHubIntegration,
    KnowledgeSource,
    utc_now,
)
from apps.api.src.services.github_auth_service import get_decrypted_access_token, get_github_integration

logger = logging.getLogger("github_repository_service")

GITHUB_API_BASE = "https://api.github.com"


async def fetch_user_repositories(
    workspace_id: str,
    db: AsyncSession,
    page: int = 1,
    per_page: int = 30,
    search_query: str = "",
) -> Dict[str, Any]:
    """
    Fetches paginated list of accessible GitHub repositories for the connected user.
    Enforces tenant access token security.
    """
    token = await get_decrypted_access_token(workspace_id, db)
    
    url = f"{GITHUB_API_BASE}/user/repos?per_page={per_page}&page={page}&sort=updated&affiliation=owner,collaborator,organization_member"

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            url,
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "SupportAI-App",
            },
        )
        if res.status_code != 200:
            logger.error(f"GitHub API error fetching repositories: {res.status_code} - {res.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"GitHub API error ({res.status_code}): Unable to list repositories.",
            )

        raw_repos = res.json()

    formatted_repos = []
    for item in raw_repos:
        full_name = item.get("full_name", "")
        repo_name = item.get("name", "")
        owner_name = item.get("owner", {}).get("login", "")

        # Filter by search query if present
        if search_query:
            sq = search_query.lower()
            if sq not in full_name.lower() and sq not in (item.get("description") or "").lower():
                continue

        formatted_repos.append({
            "id": str(item.get("id")),
            "name": repo_name,
            "full_name": full_name,
            "owner": owner_name,
            "is_private": item.get("private", False),
            "description": item.get("description"),
            "default_branch": item.get("default_branch", "main"),
            "updated_at": item.get("updated_at"),
            "html_url": item.get("html_url"),
        })

    return {
        "repositories": formatted_repos,
        "page": page,
        "per_page": per_page,
        "total_count": len(formatted_repos),
    }


async def fetch_repository_branches(
    workspace_id: str,
    owner: str,
    repo: str,
    db: AsyncSession,
) -> List[Dict[str, Any]]:
    """
    Fetches list of branches for a target GitHub repository.
    """
    token = await get_decrypted_access_token(workspace_id, db)
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/branches?per_page=100"

    async with httpx.AsyncClient(timeout=15.0) as client:
        res = await client.get(
            url,
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "SupportAI-App",
            },
        )
        if res.status_code != 200:
            logger.error(f"GitHub API error fetching branches for {owner}/{repo}: {res.status_code}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unable to fetch branches for repository '{owner}/{repo}'.",
            )

        branches_raw = res.json()

    branches = [
        {
            "name": b["name"],
            "commit_sha": b.get("commit", {}).get("sha"),
            "is_protected": b.get("protected", False),
        }
        for b in branches_raw
    ]
    return branches


async def connect_and_configure_repository(
    workspace_id: str,
    payload: Dict[str, Any],
    db: AsyncSession,
) -> GitHubRepository:
    """
    Saves or updates a GitHubRepository record and links it to KnowledgeSource.
    """
    integration = await get_github_integration(workspace_id, db)
    if not integration:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active GitHub integration found. Please connect GitHub first.",
        )

    repository_id = str(payload.get("repository_id"))
    repository_name = payload.get("repository_name")
    owner = payload.get("owner")
    branch = payload.get("branch", "main")
    default_branch = payload.get("default_branch", "main")
    is_private = payload.get("is_private", False)
    sync_config = payload.get("sync_config", {
        "sync_readme": True,
        "sync_markdown": True,
        "sync_docs": True,
        "sync_issues": False,
        "sync_pull_requests": False,
        "include_extensions": [".md", ".mdx", ".txt", ".json", ".yaml", ".yml"],
        "ignore_patterns": ["node_modules/", "dist/", "build/", ".git/", "coverage/"],
    })

    if not repository_id or not repository_name or not owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing required fields: repository_id, repository_name, owner.",
        )

    # Check existing repo connection
    res = await db.execute(
        select(GitHubRepository).where(
            GitHubRepository.workspace_id == workspace_id,
            GitHubRepository.repository_id == repository_id,
        )
    )
    existing_repo = res.scalars().first()

    if existing_repo:
        existing_repo.branch = branch
        existing_repo.default_branch = default_branch
        existing_repo.sync_config_json = sync_config
        existing_repo.sync_status = "pending"
        existing_repo.updated_at = utc_now()
        repo_record = existing_repo
    else:
        repo_record = GitHubRepository(
            workspace_id=workspace_id,
            github_integration_id=integration.id,
            repository_id=repository_id,
            repository_name=repository_name,
            owner=owner,
            branch=branch,
            default_branch=default_branch,
            is_private=is_private,
            sync_status="pending",
            sync_config_json=sync_config,
        )
        db.add(repo_record)

    await db.flush()

    # Link with unified KnowledgeSource model
    full_repo_name = f"{owner}/{repository_name}"
    res_ks = await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.workspace_id == workspace_id,
            KnowledgeSource.type == "GITHUB",
            KnowledgeSource.name == full_repo_name,
        )
    )
    existing_ks = res_ks.scalars().first()

    meta = {
        "organizationId": workspace_id,
        "githubIntegrationId": integration.id,
        "githubRepositoryRecordId": repo_record.id,
        "repositoryId": repository_id,
        "repositoryName": repository_name,
        "owner": owner,
        "branch": branch,
        "syncConfig": sync_config,
    }

    if existing_ks:
        existing_ks.status = "processing"
        existing_ks.metadata_json = meta
        existing_ks.updated_at = utc_now()
    else:
        ks = KnowledgeSource(
            workspace_id=workspace_id,
            type="GITHUB",
            name=full_repo_name,
            status="processing",
            metadata_json=meta,
        )
        db.add(ks)

    await db.commit()
    await db.refresh(repo_record)
    logger.info(f"Connected repository '{full_repo_name}' (branch: {branch}) for workspace '{workspace_id}'")
    return repo_record


async def get_connected_repositories(workspace_id: str, db: AsyncSession) -> List[GitHubRepository]:
    """
    Fetches list of connected repositories for current workspace.
    """
    res = await db.execute(
        select(GitHubRepository).where(GitHubRepository.workspace_id == workspace_id)
    )
    return list(res.scalars().all())


async def remove_connected_repository(workspace_id: str, repo_record_id: str, db: AsyncSession) -> bool:
    """
    Disconnects a repository configuration.
    """
    res = await db.execute(
        select(GitHubRepository).where(
            GitHubRepository.id == repo_record_id,
            GitHubRepository.workspace_id == workspace_id,
        )
    )
    repo = res.scalars().first()
    if not repo:
        return False

    full_repo_name = f"{repo.owner}/{repo.repository_name}"
    
    # Remove associated KnowledgeSource
    await db.execute(
        delete(KnowledgeSource).where(
            KnowledgeSource.workspace_id == workspace_id,
            KnowledgeSource.type == "GITHUB",
            KnowledgeSource.name == full_repo_name,
        )
    )

    await db.delete(repo)
    await db.commit()
    return True
