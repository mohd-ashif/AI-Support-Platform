import logging
import httpx
import json
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from fastapi import HTTPException, status

from apps.api.src.models.core import (
    Conversation,
    Message,
    GitHubRepository,
    KnowledgeChunk,
    utc_now,
)
from apps.api.src.config.settings import settings
from apps.api.src.services.github_auth_service import get_decrypted_access_token
from apps.api.src.services.chunker_service import count_tokens
from apps.api.src.services.embedding_service import generate_embeddings_for_chunks

logger = logging.getLogger("github_issue_pr_service")

GITHUB_API_BASE = "https://api.github.com"


async def generate_github_issue_preview(
    workspace_id: str,
    conversation_id: str,
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    Analyzes customer support conversation transcript using LLM and generates a structured
    GitHub Issue preview draft (Title, Description, Steps, Expected/Actual, Priority, Context).
    Does NOT create the issue on GitHub until agent approves.
    """
    res_conv = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == workspace_id,
        )
    )
    conv = res_conv.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    res_msgs = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    msgs = res_msgs.scalars().all()

    transcript = "\n".join([f"{m.sender_type.upper()}: {m.content}" for m in msgs])

    prompt = f"""You are a Technical Support Lead generating a GitHub Issue bug report from a customer support transcript.

Analyze the transcript and produce a structured JSON object with these exact keys:
- title (string): Concise summary of the bug/issue
- description (string): High-level description of what the user experienced
- steps_to_reproduce (string): Step-by-step list of user actions leading to issue
- expected_behavior (string): What should have happened
- actual_behavior (string): What actually happened
- customer_context (string): Customer ID/visitor context
- priority (string): "low", "medium", "high", or "critical"
- environment (string): Browser/OS/environment info if mentioned

Transcript:
{transcript}

Return ONLY valid raw JSON."""

    summary_data = await _call_llm_json(prompt)

    return {
        "conversation_id": conversation_id,
        "title": summary_data.get("title", "Bug Report from Customer Support"),
        "description": summary_data.get("description", "Issue reported via live chat."),
        "steps_to_reproduce": summary_data.get("steps_to_reproduce", "1. Open chat widget\n2. Perform action"),
        "expected_behavior": summary_data.get("expected_behavior", "Expected successful operation."),
        "actual_behavior": summary_data.get("actual_behavior", "Experienced error/unexpected response."),
        "customer_context": f"Visitor ID: {conv.visitor_id}",
        "priority": summary_data.get("priority", "medium"),
        "environment": summary_data.get("environment", "Web Widget"),
    }


async def create_github_issue(
    workspace_id: str,
    repo_id: str,
    issue_data: Dict[str, Any],
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    Creates an issue on GitHub via API after explicit agent review and approval.
    """
    res = await db.execute(
        select(GitHubRepository).where(
            GitHubRepository.id == repo_id,
            GitHubRepository.workspace_id == workspace_id,
        )
    )
    repo = res.scalars().first()
    if not repo:
        raise HTTPException(status_code=404, detail="Target repository connection not found.")

    token = await get_decrypted_access_token(workspace_id, db)
    url = f"{GITHUB_API_BASE}/repos/{repo.owner}/{repo.repository_name}/issues"

    body_markdown = f"""### Description
{issue_data.get('description', '')}

### Steps to Reproduce
{issue_data.get('steps_to_reproduce', '')}

### Expected Behavior
{issue_data.get('expected_behavior', '')}

### Actual Behavior
{issue_data.get('actual_behavior', '')}

---
**Priority**: `{issue_data.get('priority', 'medium').upper()}`
**Customer Context**: {issue_data.get('customer_context', 'N/A')}
**Environment**: {issue_data.get('environment', 'N/A')}

*Reported via SupportAI Operator Inbox*"""

    labels = ["bug", "support-ai"]
    if issue_data.get("priority") == "critical":
        labels.append("priority: critical")

    async with httpx.AsyncClient(timeout=15.0) as client:
        res_gh = await client.post(
            url,
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "SupportAI-App",
            },
            json={
                "title": issue_data.get("title", "SupportAI Reported Issue"),
                "body": body_markdown,
                "labels": labels,
            },
        )

        if res_gh.status_code != 201:
            logger.error(f"GitHub API error creating issue: {res_gh.status_code} - {res_gh.text}")
            raise HTTPException(status_code=400, detail=f"GitHub API Error: {res_gh.text}")

        issue_obj = res_gh.json()

    logger.info(f"Successfully created GitHub issue #{issue_obj.get('number')} on {repo.owner}/{repo.repository_name}")
    return {
        "issue_number": issue_obj.get("number"),
        "title": issue_obj.get("title"),
        "html_url": issue_obj.get("html_url"),
        "state": issue_obj.get("state"),
        "repository": f"{repo.owner}/{repo.repository_name}",
    }


async def fetch_and_index_github_issues(
    workspace_id: str,
    owner: str,
    repo_name: str,
    repo_record_id: str,
    db: AsyncSession,
) -> int:
    """
    Fetches open and closed issues from GitHub API and indexes them into vector DB.
    """
    token = await get_decrypted_access_token(workspace_id, db)
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo_name}/issues?state=all&per_page=50"

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
            logger.warning(f"Failed to fetch GitHub issues for {owner}/{repo_name}: {res.status_code}")
            return 0
        issues_raw = res.json()

    chunks_to_insert = []
    full_repo_name = f"{owner}/{repo_name}"

    for issue in issues_raw:
        if "pull_request" in issue:
            continue

        issue_num = issue.get("number")
        title = issue.get("title", "")
        body = issue.get("body", "") or ""
        state = issue.get("state", "open")
        html_url = issue.get("html_url", "")
        author = issue.get("user", {}).get("login", "")

        content = f"GitHub Issue #{issue_num}: {title}\nStatus: {state.upper()}\nAuthor: @{author}\n\n{body}"

        meta = {
            "organizationId": workspace_id,
            "sourceType": "GITHUB_ISSUE",
            "repository": full_repo_name,
            "issueNumber": issue_num,
            "title": title,
            "state": state,
            "author": author,
            "url": html_url,
            "document_name": f"Issue #{issue_num}: {title}",
        }

        chunks_to_insert.append({
            "content": content,
            "token_count": count_tokens(content),
            "meta": meta,
        })

    if chunks_to_insert:
        chunks_with_embeddings = generate_embeddings_for_chunks(chunks_to_insert)
        for idx, item in enumerate(chunks_with_embeddings):
            kc = KnowledgeChunk(
                workspace_id=workspace_id,
                source_type="github_issue",
                source_id=repo_record_id,
                chunk_index=idx,
                content=item["content"],
                embedding=item.get("embedding"),
                token_count=item["token_count"],
                metadata_json=item["meta"],
            )
            db.add(kc)
        await db.commit()

    return len(chunks_to_insert)


async def fetch_and_index_github_prs(
    workspace_id: str,
    owner: str,
    repo_name: str,
    repo_record_id: str,
    db: AsyncSession,
) -> int:
    """
    Fetches merged and open Pull Requests from GitHub API and indexes them into vector DB.
    """
    token = await get_decrypted_access_token(workspace_id, db)
    url = f"{GITHUB_API_BASE}/repos/{owner}/{repo_name}/pulls?state=all&per_page=50"

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
            logger.warning(f"Failed to fetch GitHub PRs for {owner}/{repo_name}: {res.status_code}")
            return 0
        prs_raw = res.json()

    chunks_to_insert = []
    full_repo_name = f"{owner}/{repo_name}"

    for pr in prs_raw:
        pr_num = pr.get("number")
        title = pr.get("title", "")
        body = pr.get("body", "") or ""
        state = pr.get("state", "open")
        merged_at = pr.get("merged_at")
        html_url = pr.get("html_url", "")
        author = pr.get("user", {}).get("login", "")

        status_str = "MERGED" if merged_at else state.upper()
        content = f"Pull Request #{pr_num}: {title}\nStatus: {status_str}\nAuthor: @{author}\nMerged At: {merged_at or 'N/A'}\n\n{body}"

        meta = {
            "organizationId": workspace_id,
            "sourceType": "GITHUB_PR",
            "repository": full_repo_name,
            "prNumber": pr_num,
            "title": title,
            "state": status_str,
            "author": author,
            "mergedAt": merged_at,
            "url": html_url,
            "document_name": f"PR #{pr_num}: {title}",
        }

        chunks_to_insert.append({
            "content": content,
            "token_count": count_tokens(content),
            "meta": meta,
        })

    if chunks_to_insert:
        chunks_with_embeddings = generate_embeddings_for_chunks(chunks_to_insert)
        for idx, item in enumerate(chunks_with_embeddings):
            kc = KnowledgeChunk(
                workspace_id=workspace_id,
                source_type="github_pr",
                source_id=repo_record_id,
                chunk_index=idx,
                content=item["content"],
                embedding=item.get("embedding"),
                token_count=item["token_count"],
                metadata_json=item["meta"],
            )
            db.add(kc)
        await db.commit()

    return len(chunks_to_insert)


async def _call_llm_json(prompt: str) -> Dict[str, Any]:
    """
    Helper calling LLM and parsing JSON object.
    """
    groq_key = getattr(settings, "GROQ_API_KEY", "")
    if groq_key and not groq_key.startswith("mock_"):
        try:
            async with httpx.AsyncClient(timeout=20.0) as client:
                res = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {groq_key}", "Content-Type": "application/json"},
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0.1,
                        "response_format": {"type": "json_object"},
                    },
                )
                if res.status_code == 200:
                    txt = res.json()["choices"][0]["message"]["content"]
                    return json.loads(txt)
        except Exception:
            pass

    return {
        "title": "Reported Customer Support Issue",
        "description": "Customer encountered an issue during widget conversation.",
        "steps_to_reproduce": "1. User sent message\n2. Support request generated",
        "expected_behavior": "Normal expected function",
        "actual_behavior": "Error response reported",
        "priority": "medium",
    }
