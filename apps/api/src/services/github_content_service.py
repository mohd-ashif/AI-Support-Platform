import logging
import base64
import httpx
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import HTTPException, status

from apps.api.src.services.github_auth_service import get_decrypted_access_token

logger = logging.getLogger("github_content_service")

GITHUB_API_BASE = "https://api.github.com"


class GitHubContentService:
    """
    Centralized GitHub API client for fetching git repository trees, file contents,
    commits, issues, and pull requests while handling rate limits and timeouts.
    """

    @staticmethod
    async def fetch_repository_tree(
        workspace_id: str,
        owner: str,
        repo: str,
        branch: str,
        db: AsyncSession,
    ) -> List[Dict[str, Any]]:
        """
        Fetches the recursive git tree for a repository branch.
        """
        token = await get_decrypted_access_token(workspace_id, db)
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/git/trees/{branch}?recursive=1"

        async with httpx.AsyncClient(timeout=20.0) as client:
            res = await client.get(
                url,
                headers={
                    "Authorization": f"token {token}",
                    "Accept": "application/vnd.github.v3+json",
                    "User-Agent": "SupportAI-App",
                },
            )

            # Automatic fallback for main vs master branch mismatch
            if res.status_code == 404 and branch in ("main", "master"):
                fallback_branch = "master" if branch == "main" else "main"
                logger.info(f"Branch '{branch}' not found for {owner}/{repo}, trying fallback branch '{fallback_branch}'...")
                fallback_url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/git/trees/{fallback_branch}?recursive=1"
                res = await client.get(
                    fallback_url,
                    headers={
                        "Authorization": f"token {token}",
                        "Accept": "application/vnd.github.v3+json",
                        "User-Agent": "SupportAI-App",
                    },
                )

            # Check rate limiting
            remaining = res.headers.get("x-ratelimit-remaining")
            if remaining and int(remaining) < 5:
                logger.warning(f"GitHub API rate limit warning: {remaining} requests remaining.")

            if res.status_code == 403 and "rate limit exceeded" in res.text.lower():
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="GitHub API rate limit exceeded. Please try again in a few minutes.",
                )

            if res.status_code != 200:
                logger.error(f"Failed to fetch git tree for {owner}/{repo}@{branch}: {res.status_code} - {res.text}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"GitHub API error ({res.status_code}): Unable to fetch repository tree for branch '{branch}'.",
                )

            data = res.json()

        tree_items = data.get("tree", [])
        files = [
            {
                "path": item["path"],
                "type": item["type"],  # 'blob' (file) or 'tree' (dir)
                "sha": item.get("sha"),
                "size": item.get("size", 0),
                "url": item.get("url"),
            }
            for item in tree_items
            if item.get("type") == "blob"
        ]
        return files

    @staticmethod
    async def fetch_file_content(
        workspace_id: str,
        owner: str,
        repo: str,
        path: str,
        ref: str,
        db: AsyncSession,
    ) -> Optional[str]:
        """
        Fetches raw content for a single file at a given commit/branch reference.
        """
        token = await get_decrypted_access_token(workspace_id, db)
        return await GitHubContentService.fetch_file_content_with_token(owner, repo, path, ref, token)

    @staticmethod
    async def fetch_file_content_with_token(
        owner: str,
        repo: str,
        path: str,
        ref: str,
        token: str,
    ) -> Optional[str]:
        """
        Fetches raw content for a single file using a pre-retrieved access token (thread-safe for async gather).
        """
        url = f"{GITHUB_API_BASE}/repos/{owner}/{repo}/contents/{path}?ref={ref}"

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
                logger.warning(f"Failed to fetch file content for {path} at {ref}: status={res.status_code}")
                return None

            data = res.json()
            content_b64 = data.get("content")
            encoding = data.get("encoding")

            if content_b64 and encoding == "base64":
                try:
                    cleaned_b64 = content_b64.replace("\n", "").replace("\r", "")
                    decoded_bytes = base64.b64decode(cleaned_b64)
                    return decoded_bytes.decode("utf-8", errors="replace")
                except Exception as err:
                    logger.error(f"Error decoding base64 content for file {path}: {err}")
                    return None
            
            return None
