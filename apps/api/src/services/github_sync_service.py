import re
import uuid
import asyncio
import logging
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from fastapi import HTTPException, status

from apps.api.src.models.core import (
    GitHubRepository,
    KnowledgeSource,
    KnowledgeDocument,
    DocumentVersion,
    KnowledgeChunk,
    utc_now,
)
from apps.api.src.services.github_content_service import GitHubContentService
from apps.api.src.services.chunker_service import chunk_text
from apps.api.src.services.embedding_service import generate_embeddings_for_chunks
from apps.api.src.services.normalizer_service import normalize_text, extract_chunk_metadata

logger = logging.getLogger("github_sync_service")

# Comprehensive regex patterns for detecting and redacting secrets in repository code
SECRET_PATTERNS = [
    (re.compile(r'(?i)(api[_-]?key|secret|token|password|auth_key)\s*[:=]\s*["\']([^"\']+)["\']'), r'\1="[REDACTED]"'),
    (re.compile(r'-----BEGIN (RSA|OPENSSH|PRIVATE|EC|DSA) KEY-----[\s\S]+?-----END \1 KEY-----'), '[REDACTED_PRIVATE_KEY]'),
    (re.compile(r'sk_live_[0-9a-zA-Z]{24,}'), '[REDACTED_STRIPE_SECRET]'),
    (re.compile(r'ghp_[0-9a-zA-Z]{36}'), '[REDACTED_GITHUB_TOKEN]'),
    (re.compile(r'gho_[0-9a-zA-Z]{36}'), '[REDACTED_GITHUB_OAUTH_TOKEN]'),
    (re.compile(r'gsk_[0-9a-zA-Z]{40,}'), '[REDACTED_GROQ_KEY]'),
    (re.compile(r'sk-proj-[0-9a-zA-Z_-]{20,}'), '[REDACTED_OPENAI_KEY]'),
    (re.compile(r'AKIA[0-9A-Z]{16}'), '[REDACTED_AWS_ACCESS_KEY]'),
    (re.compile(r'eyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*'), '[REDACTED_JWT_TOKEN]'),
    (re.compile(r'postgres(ql)?://[^:]+:[^@]+@'), 'postgresql://[REDACTED]:[REDACTED]@'),
]

DEFAULT_IGNORED_DIRS = [
    "node_modules/", "dist/", "build/", ".git/", "coverage/",
    "vendor/", ".env", ".env.", "venv/", "__pycache__/", ".next/",
    ".github/", "lock.json", "yarn.lock", "pnpm-lock.yaml",
]

BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp",
    ".mp3", ".mp4", ".mov", ".avi", ".pdf", ".zip", ".tar", ".gz",
    ".exe", ".dll", ".so", ".dylib", ".woff", ".woff2", ".ttf", ".eot",
    ".pyc", ".pyo", ".sqlite", ".db",
}


def redact_secrets(content: str) -> str:
    """
    Scans document or code content for sensitive keys, passwords, and private tokens,
    redacting matching values before storing or sending to embedding services.
    """
    if not content:
        return ""
    sanitized = content
    for pattern, replacement in SECRET_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    return sanitized


def should_index_file(file_path: str, sync_config: Dict[str, Any]) -> bool:
    """
    Determines if a repository file should be indexed based on configuration rules.
    """
    lower_path = file_path.lower()

    # Reject binary files & locks
    for bin_ext in BINARY_EXTENSIONS:
        if lower_path.endswith(bin_ext):
            return False

    # Check ignored directory patterns
    ignore_patterns = sync_config.get("ignore_patterns", []) or DEFAULT_IGNORED_DIRS
    for pattern in ignore_patterns:
        pat_clean = pattern.strip().lower()
        if pat_clean and pat_clean in lower_path:
            return False

    # Standard Knowledge Rules
    sync_readme = sync_config.get("sync_readme", True)
    sync_docs = sync_config.get("sync_docs", True)
    sync_markdown = sync_config.get("sync_markdown", True)
    default_exts = [
        ".md", ".mdx", ".txt", ".json", ".yaml", ".yml",
        ".py", ".ts", ".tsx", ".js", ".jsx", ".java", ".go",
        ".rs", ".cpp", ".c", ".h", ".cs", ".php", ".rb", ".sql", ".sh"
    ]
    include_exts = sync_config.get("include_extensions") or default_exts

    # Rule 1: README
    if sync_readme and ("readme.md" in lower_path or "readme" in lower_path):
        return True

    # Rule 2: docs/ folder
    if sync_docs and (lower_path.startswith("docs/") or "/docs/" in lower_path or lower_path.startswith("documentation/")):
        return True

    # Rule 3: Markdown / MDX files
    if sync_markdown and (lower_path.endswith(".md") or lower_path.endswith(".mdx")):
        return True

    # Rule 4: Whitelisted file extensions
    for ext in include_exts:
        ext_clean = ext.strip().lower()
        if ext_clean and lower_path.endswith(ext_clean):
            return True

    return False


SYMBOL_REGEX = re.compile(r'\b(class|interface|enum|struct|type|def|function)\s+([A-Za-z0-9_]+)')

def extract_code_symbol(chunk_content: str) -> Optional[str]:
    """
    Extracts primary class, interface, function, or markdown heading symbol name from chunk text.
    """
    if not chunk_content:
        return None
    # Check Markdown heading
    m_head = re.search(r'^#{1,4}\s+(.+)$', chunk_content, re.MULTILINE)
    if m_head:
        return m_head.group(1).strip()
    
    # Check Code Symbols
    m_code = SYMBOL_REGEX.search(chunk_content)
    if m_code:
        return m_code.group(2).strip()
        
    return None


async def trigger_repository_sync(
    workspace_id: str,
    repo_id: str,
    db: AsyncSession,
) -> Dict[str, Any]:
    """
    Fast API entry point to trigger an asynchronous repository sync.
    Updates sync status to 'syncing' and dispatches background worker task.
    """
    res = await db.execute(
        select(GitHubRepository).where(
            GitHubRepository.id == repo_id,
            GitHubRepository.workspace_id == workspace_id,
        )
    )
    repo = res.scalars().first()
    if not repo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target GitHub repository connection not found.",
        )

    repo.sync_status = "syncing"
    repo.error_message = None
    repo.updated_at = utc_now()

    # Update KnowledgeSource status
    full_repo_name = f"{repo.owner}/{repo.repository_name}"
    res_ks = await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.workspace_id == workspace_id,
            KnowledgeSource.type == "GITHUB",
            KnowledgeSource.name == full_repo_name,
        )
    )
    ks = res_ks.scalars().first()
    if ks:
        ks.status = "indexing"
        ks.updated_at = utc_now()

    await db.commit()

    sync_job_id = f"sync_{uuid.uuid4().hex[:12]}"

    # Launch non-blocking background runner
    asyncio.create_task(execute_repository_sync_job(workspace_id=workspace_id, repo_id=repo.id))

    # Also dispatch via Celery if available
    try:
        from apps.api.src.celery_app import sync_github_repository_task
        sync_github_repository_task.apply_async(args=(repo.id, workspace_id), expires=300)
    except Exception:
        pass

    logger.info(f"Triggered background sync job '{sync_job_id}' for repository '{full_repo_name}'")
    return {
        "status": "queued",
        "sync_job_id": sync_job_id,
        "repository": full_repo_name,
        "branch": repo.branch,
    }


async def execute_repository_sync_job(workspace_id: str, repo_id: str) -> None:
    """
    Background worker function executing repository content fetching, secret redaction,
    chunking, embedding, and pgvector storage.
    """
    from apps.api.src.database.session import AsyncSessionLocal

    logger.info(f"[GITHUB-SYNC-WORKER] Starting repository sync job for repo_id={repo_id} | workspace_id={workspace_id}")

    try:
        async with AsyncSessionLocal() as db:
            res = await db.execute(
                select(GitHubRepository).where(
                    GitHubRepository.id == repo_id,
                    GitHubRepository.workspace_id == workspace_id,
                )
            )
            repo = res.scalars().first()
            if not repo:
                logger.error(f"[GITHUB-SYNC-WORKER] Repository {repo_id} not found in DB")
                return

            owner = repo.owner
            repo_name = repo.repository_name
            branch = repo.branch
            sync_config = repo.sync_config_json or {}
            full_repo_name = f"{owner}/{repo_name}"

            # Step 1: Fetch recursive Git Tree
            files = await GitHubContentService.fetch_repository_tree(
                workspace_id=workspace_id,
                owner=owner,
                repo=repo_name,
                branch=branch,
                db=db,
            )

            # Step 2: Filter candidate files
            target_files = [f for f in files if should_index_file(f["path"], sync_config)]
            logger.info(f"[GITHUB-SYNC-WORKER] Found {len(target_files)} eligible files out of {len(files)} in {full_repo_name}")

            all_chunks_to_insert = []
            files_processed_count = 0
            latest_commit_sha = target_files[0]["sha"] if target_files else "main"

            from apps.api.src.services.github_auth_service import get_decrypted_access_token
            access_token = await get_decrypted_access_token(workspace_id, db)

            # Step 3: Fetch file content, redact secrets, chunk in parallel batches
            async def process_single_file(file_info: dict) -> list:
                file_path = file_info["path"]
                file_sha = file_info["sha"]
                github_file_url = f"https://github.com/{owner}/{repo_name}/blob/{branch}/{file_path}"
                try:
                    content_raw = await GitHubContentService.fetch_file_content_with_token(
                        owner=owner,
                        repo=repo_name,
                        path=file_path,
                        ref=branch,
                        token=access_token,
                    )

                    if not content_raw or len(content_raw.strip()) < 10:
                        return []

                    sanitized_content = redact_secrets(content_raw)
                    clean_text = normalize_text(sanitized_content)

                    file_chunks = chunk_text(clean_text, target_tokens=250, overlap_tokens=30)
                    if not file_chunks:
                        file_chunks = [{
                            "chunk_index": 0,
                            "content": clean_text,
                            "token_count": len(clean_text.split()),
                        }]

                    extracted_chunks = []
                    for fc in file_chunks:
                        char_start = fc.get("char_start", 0)
                        char_end = fc.get("char_end", len(clean_text))
                        line_start = clean_text[:char_start].count("\n") + 1
                        line_end = clean_text[:char_end].count("\n") + 1
                        deep_link_url = f"{github_file_url}#L{line_start}-L{line_end}"

                        extracted_chunks.append({
                            "file_path": file_path,
                            "file_sha": file_sha,
                            "github_url": deep_link_url,
                            "base_github_url": github_file_url,
                            "chunk_index": fc["chunk_index"],
                            "content": fc["content"],
                            "token_count": fc["token_count"],
                            "line_start": line_start,
                            "line_end": line_end,
                        })
                    return extracted_chunks
                except Exception as file_err:
                    logger.warning(f"[GITHUB-SYNC-WORKER] Skipping file {file_path} due to error: {file_err}")
                    return []

            candidate_files = target_files[:100]
            batch_size = 10
            for i in range(0, len(candidate_files), batch_size):
                batch = candidate_files[i : i + batch_size]
                batch_results = await asyncio.gather(*[process_single_file(f) for f in batch])
                for chunks in batch_results:
                    all_chunks_to_insert.extend(chunks)
                files_processed_count += len(batch)

            # Step 4: Generate Embeddings
            logger.info(f"[GITHUB-SYNC-WORKER] Generating embeddings for {len(all_chunks_to_insert)} chunks...")
            chunks_with_embeddings = generate_embeddings_for_chunks(all_chunks_to_insert)

            # Step 5: Save Knowledge Chunks to DB
            async with AsyncSessionLocal() as write_db:
                # Clear existing chunks for this repository source
                await write_db.execute(
                    delete(KnowledgeChunk).where(
                        KnowledgeChunk.workspace_id == workspace_id,
                        KnowledgeChunk.source_id == repo.id,
                    )
                )

                for idx, item in enumerate(chunks_with_embeddings):
                    symbol_name = extract_code_symbol(item["content"])
                    line_range_str = f"L{item['line_start']}-L{item['line_end']}"
                    doc_label = symbol_name if symbol_name else line_range_str
                    meta = {
                        "organizationId": workspace_id,
                        "sourceType": "GITHUB",
                        "githubIntegrationId": repo.github_integration_id,
                        "repository": full_repo_name,
                        "owner": owner,
                        "branch": branch,
                        "filePath": item["file_path"],
                        "commitSha": item["file_sha"],
                        "lineStart": item["line_start"],
                        "lineEnd": item["line_end"],
                        "symbol": symbol_name,
                        "fileType": item["file_path"].split(".")[-1] if "." in item["file_path"] else "code",
                        "url": item["github_url"],
                        "document_name": f"{repo_name}: {item['file_path']} ({doc_label})",
                    }

                    kc = KnowledgeChunk(
                        workspace_id=workspace_id,
                        source_type="github",
                        source_id=repo.id,
                        chunk_index=idx,
                        content=item["content"],
                        embedding=item.get("embedding"),
                        token_count=item["token_count"],
                        metadata_json=meta,
                    )
                    write_db.add(kc)

                # Update Repository & Knowledge Source Status to READY
                res_r = await write_db.execute(select(GitHubRepository).where(GitHubRepository.id == repo_id))
                r_obj = res_r.scalars().first()
                if r_obj:
                    r_obj.sync_status = "ready"
                    r_obj.last_synced_commit = latest_commit_sha
                    r_obj.last_synced_at = utc_now()

                res_k = await write_db.execute(
                    select(KnowledgeSource).where(
                        KnowledgeSource.workspace_id == workspace_id,
                        KnowledgeSource.type == "GITHUB",
                        KnowledgeSource.name == full_repo_name,
                    )
                )
                k_obj = res_k.scalars().first()
                if k_obj:
                    k_obj.status = "ready"
                    k_obj.updated_at = utc_now()

                await write_db.commit()
                logger.info(f"[GITHUB-SYNC-WORKER] Sync completed! Processed {files_processed_count} files, stored {len(chunks_with_embeddings)} chunks into pgvector.")

    except Exception as err:
        logger.error(f"[GITHUB-SYNC-WORKER] Repository sync job failed for repo {repo_id}: {err}", exc_info=True)
        try:
            async with AsyncSessionLocal() as err_db:
                res_r = await err_db.execute(select(GitHubRepository).where(GitHubRepository.id == repo_id))
                r_obj = res_r.scalars().first()
                if r_obj:
                    r_obj.sync_status = "failed"
                    r_obj.error_message = str(err)

                res_k = await err_db.execute(
                    select(KnowledgeSource).where(
                        KnowledgeSource.workspace_id == workspace_id,
                        KnowledgeSource.type == "GITHUB",
                    )
                )
                k_obj = res_k.scalars().first()
                if k_obj:
                    k_obj.status = "failed"

                await err_db.commit()
        except Exception:
            pass


async def execute_incremental_repository_sync(
    workspace_id: str,
    repo_id: str,
    base_commit_sha: str,
    db: AsyncSession,
) -> bool:
    """
    Executes scalable incremental repository sync by comparing base_commit_sha with head branch.
    Only added, modified, or deleted files are processed.
    """
    from apps.api.src.services.github_auth_service import get_decrypted_access_token
    import httpx

    res = await db.execute(
        select(GitHubRepository).where(
            GitHubRepository.id == repo_id,
            GitHubRepository.workspace_id == workspace_id,
        )
    )
    repo = res.scalars().first()
    if not repo:
        return False

    owner = repo.owner
    repo_name = repo.repository_name
    branch = repo.branch
    token = await get_decrypted_access_token(workspace_id, db)
    url = f"https://api.github.com/repos/{owner}/{repo_name}/compare/{base_commit_sha}...{branch}"

    async with httpx.AsyncClient(timeout=15.0) as client:
        res_comp = await client.get(
            url,
            headers={
                "Authorization": f"token {token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "SupportAI-App",
            },
        )
        if res_comp.status_code != 200:
            logger.warning(f"Git compare failed for {owner}/{repo_name} ({base_commit_sha}...{branch}). Falling back to full sync.")
            return False

        compare_data = res_comp.json()

    diff_files = compare_data.get("files", [])
    head_commit = compare_data.get("commits", [{}])[-1].get("sha", base_commit_sha) if compare_data.get("commits") else base_commit_sha

    logger.info(f"[INCREMENTAL-SYNC] Found {len(diff_files)} changed files between {base_commit_sha[:7]} and {branch}")

    sync_config = repo.sync_config_json or {}
    full_repo_name = f"{owner}/{repo_name}"

    for f_info in diff_files:
        file_path = f_info.get("filename")
        status_type = f_info.get("status")  # 'added', 'modified', 'removed', 'renamed'

        if not file_path:
            continue

        # If removed or modified, delete existing chunks for this specific file
        if status_type in ("removed", "modified", "renamed"):
            chunks_res = await db.execute(
                select(KnowledgeChunk).where(
                    KnowledgeChunk.workspace_id == workspace_id,
                    KnowledgeChunk.source_id == repo_id,
                )
            )
            existing_chunks = chunks_res.scalars().all()
            for c in existing_chunks:
                meta = dict(c.metadata_json or {})
                if meta.get("filePath") == file_path or meta.get("path") == file_path:
                    await db.delete(c)
            await db.flush()

        # If added or modified, re-fetch content & re-index
        if status_type in ("added", "modified", "renamed") and should_index_file(file_path, sync_config):
            content_raw = await GitHubContentService.fetch_file_content(
                workspace_id=workspace_id,
                owner=owner,
                repo=repo_name,
                path=file_path,
                ref=branch,
                db=db,
            )
            if not content_raw or len(content_raw.strip()) < 10:
                continue

            sanitized_content = redact_secrets(content_raw)
            clean_text = normalize_text(sanitized_content)

            file_chunks = chunk_text(clean_text, target_tokens=250, overlap_tokens=30)
            if not file_chunks:
                file_chunks = [{"chunk_index": 0, "content": clean_text, "token_count": len(clean_text.split())}]

            chunks_payload = []
            github_file_url = f"https://github.com/{owner}/{repo_name}/blob/{branch}/{file_path}"

            for fc in file_chunks:
                char_start = fc.get("char_start", 0)
                char_end = fc.get("char_end", len(clean_text))
                line_start = clean_text[:char_start].count("\n") + 1
                line_end = clean_text[:char_end].count("\n") + 1

                chunks_payload.append({
                    "content": fc["content"],
                    "token_count": fc["token_count"],
                    "line_start": line_start,
                    "line_end": line_end,
                })

            embedded = generate_embeddings_for_chunks(chunks_payload)

            for idx, item in enumerate(embedded):
                symbol_name = extract_code_symbol(item["content"])
                deep_url = f"{github_file_url}#L{item['line_start']}-L{item['line_end']}"
                line_range_str = f"L{item['line_start']}-L{item['line_end']}"
                doc_label = symbol_name if symbol_name else line_range_str
                meta = {
                    "organizationId": workspace_id,
                    "sourceType": "GITHUB",
                    "githubIntegrationId": repo.github_integration_id,
                    "repository": full_repo_name,
                    "owner": owner,
                    "branch": branch,
                    "filePath": file_path,
                    "commitSha": head_commit,
                    "lineStart": item["line_start"],
                    "lineEnd": item["line_end"],
                    "symbol": symbol_name,
                    "fileType": file_path.split(".")[-1] if "." in file_path else "code",
                    "url": deep_url,
                    "document_name": f"{repo_name}: {file_path} ({doc_label})",
                }

                kc = KnowledgeChunk(
                    workspace_id=workspace_id,
                    source_type="github",
                    source_id=repo_id,
                    chunk_index=idx,
                    content=item["content"],
                    embedding=item.get("embedding"),
                    token_count=item["token_count"],
                    metadata_json=meta,
                )
                db.add(kc)

    repo.last_synced_commit = head_commit
    repo.last_synced_at = utc_now()
    repo.sync_status = "ready"
    await db.commit()
    logger.info(f"[INCREMENTAL-SYNC] Incremental sync complete for {full_repo_name} at commit {head_commit[:7]}")
    return True

