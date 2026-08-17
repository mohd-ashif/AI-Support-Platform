import logging
from typing import Optional, Literal
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import get_current_user, get_current_workspace_member
from apps.api.src.models.core import User, TeamMember, Workspace
from apps.api.src.config.settings import settings

logger = logging.getLogger("integrations_router")

router = APIRouter(prefix="/integrations", tags=["integrations"])

class SnippetResponse(BaseModel):
    platform: str
    workspace_uuid: str
    snippet_code: str
    instructions: Optional[str] = None

@router.get("/snippet", response_model=SnippetResponse)
async def get_integration_snippet(
    platform: Literal["html", "react", "nextjs", "other"] = Query("html"),
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res_ws = await db.execute(select(Workspace).where(Workspace.id == member.workspace_id))
    ws = res_ws.scalars().first()
    if not ws:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Workspace not found")

    # STEP 3 Trigger: Set workspaces.integration_viewed = True on first snippet call
    if not ws.integration_viewed:
        ws.integration_viewed = True
        await db.commit()

    cdn_script_url = f"{settings.FRONTEND_URL}/widget/loader.js"
    ws_uuid = ws.workspace_uuid

    if platform == "html":
        snippet_code = f'<!-- SupportAI Live Chat Widget -->\n<script\n  src="{cdn_script_url}"\n  data-workspace-id="{ws_uuid}"\n  async\n  defer\n></script>'
        instructions = "Paste this script tag directly into your website HTML file right before the closing </body> tag."

    elif platform == "react":
        snippet_code = (
            "// 1. Install widget helper: npm install @supportai/react-widget\n\n"
            'import { SupportAIWidget } from "@supportai/react-widget";\n\n'
            "export default function App() {\n"
            "  return (\n"
            "    <div>\n"
            "      {/* SupportAI Embed */}\n"
            f'      <SupportAIWidget workspaceId="{ws_uuid}" />\n'
            "    </div>\n"
            "  );\n"
            "}"
        )
        instructions = "Import and render the SupportAIWidget component in your main App root component."

    elif platform == "nextjs":
        snippet_code = (
            '// Next.js App Router / Pages Router Embed\nimport Script from "next/script";\n\n'
            "export default function RootLayout({ children }) {\n"
            "  return (\n"
            "    <html>\n"
            "      <body>\n"
            "        {children}\n"
            "        <Script\n"
            f'          src="{cdn_script_url}"\n'
            f'          data-workspace-id="{ws_uuid}"\n'
            '          strategy="lazyOnload"\n'
            "        />\n"
            "      </body>\n"
            "    </html>\n"
            "  );\n"
            "}"
        )
        instructions = "Use Next.js next/script component with strategy='lazyOnload' to optimize page loading performance."


    else:  # "other"
        snippet_code = f'<!-- SupportAI Universal Script -->\n<script\n  src="{cdn_script_url}"\n  data-workspace-id="{ws_uuid}"\n  async\n  defer\n></script>'
        instructions = (
            "• WordPress: Add to a Custom HTML block or theme header.php file.\n"
            "• Webflow: Paste in Custom Code section under Page Settings (Before </body> tag).\n"
            "• Shopify: Open Online Store -> Edit Code -> paste in theme.liquid right before </body>."
        )

    return SnippetResponse(
        platform=platform,
        workspace_uuid=ws_uuid,
        snippet_code=snippet_code,
        instructions=instructions,
    )


# ==========================================
# GITHUB OAUTH & CONNECTION ENDPOINTS
# ==========================================

from fastapi.responses import RedirectResponse
from apps.api.src.dependencies.auth import require_role
from apps.api.src.services.github_auth_service import (
    get_github_auth_url,
    handle_github_callback,
    get_github_integration,
    disconnect_github_integration,
)

class GitHubConnectionResponse(BaseModel):
    id: str
    workspace_id: str
    github_user_id: str
    github_username: str
    github_avatar_url: Optional[str] = None
    status: str
    created_at: str
    updated_at: str


@router.get("/github/auth-url")
async def get_github_authorization_url(
    member: TeamMember = Depends(require_role(["owner", "admin"])),
):
    """
    Returns signed GitHub OAuth authorization URL for initiating the GitHub connection.
    Requires owner or admin role.
    """
    auth_url = get_github_auth_url(member.workspace_id)
    return {"url": auth_url}


@router.get("/github/callback")
async def github_oauth_callback(
    code: str,
    state: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Callback endpoint for GitHub OAuth code exchange.
    Verifies state token, exchanges code for access token, saves connection in DB,
    and redirects user back to frontend integrations page.
    """
    try:
        integration = await handle_github_callback(code=code, state=state, db=db)
        redirect_target = f"{settings.FRONTEND_URL}/dashboard/settings?tab=integrations&status=github_success&user={integration.github_username}"
        return RedirectResponse(url=redirect_target)
    except HTTPException as exc:
        redirect_error = f"{settings.FRONTEND_URL}/dashboard/settings?tab=integrations&status=github_error&error={exc.detail}"
        return RedirectResponse(url=redirect_error)
    except Exception as exc:
        logger.error(f"Unhandled error during GitHub OAuth callback: {exc}")
        redirect_error = f"{settings.FRONTEND_URL}/dashboard/settings?tab=integrations&status=github_error&error=OAuth processing failed"
        return RedirectResponse(url=redirect_error)


@router.get("/github/connection", response_model=Optional[GitHubConnectionResponse])
async def get_github_connection_status(
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetches the active GitHub connection for the current workspace.
    Tokens are NEVER returned in response payloads for security.
    """
    integration = await get_github_integration(member.workspace_id, db)
    if not integration:
        return None

    return GitHubConnectionResponse(
        id=integration.id,
        workspace_id=integration.workspace_id,
        github_user_id=integration.github_user_id,
        github_username=integration.github_username,
        github_avatar_url=integration.github_avatar_url,
        status=integration.status,
        created_at=integration.created_at.isoformat(),
        updated_at=integration.updated_at.isoformat(),
    )


@router.delete("/github/connection")
async def disconnect_github(
    member: TeamMember = Depends(require_role(["owner", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Disconnects and revokes GitHub integration for current workspace.
    Requires owner or admin role.
    """
    success = await disconnect_github_integration(member.workspace_id, db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active GitHub connection found to disconnect.",
        )

    return {"status": "disconnected", "workspace_id": member.workspace_id}


# ==========================================
# REPOSITORY & BRANCH SELECTION ENDPOINTS
# ==========================================

from apps.api.src.services.github_repository_service import (
    fetch_user_repositories,
    fetch_repository_branches,
    connect_and_configure_repository,
    get_connected_repositories,
    remove_connected_repository,
)

class ConnectRepoRequest(BaseModel):
    repository_id: str
    repository_name: str
    owner: str
    branch: str = "main"
    default_branch: str = "main"
    is_private: bool = False
    sync_config: Optional[dict] = None


@router.get("/github/repositories")
async def list_github_repositories(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str = Query(""),
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetches accessible repositories for the connected GitHub account with pagination & search.
    """
    return await fetch_user_repositories(
        workspace_id=member.workspace_id,
        db=db,
        page=page,
        per_page=per_page,
        search_query=search,
    )


@router.get("/github/repositories/{owner}/{repo}/branches")
async def list_github_repository_branches(
    owner: str,
    repo: str,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Fetches available branches for a selected GitHub repository.
    """
    return await fetch_repository_branches(
        workspace_id=member.workspace_id,
        owner=owner,
        repo=repo,
        db=db,
    )


@router.post("/github/connect-repo")
async def connect_github_repository(
    payload: ConnectRepoRequest,
    member: TeamMember = Depends(require_role(["owner", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Connects and configures a GitHub repository as a Knowledge Source for the active workspace.
    """
    repo_record = await connect_and_configure_repository(
        workspace_id=member.workspace_id,
        payload=payload.model_dump(),
        db=db,
    )

    # Launch background repository sync job automatically!
    try:
        from apps.api.src.services.github_sync_service import trigger_repository_sync
        await trigger_repository_sync(workspace_id=member.workspace_id, repo_id=repo_record.id, db=db)
    except Exception as err:
        logger.warning(f"Initial sync trigger note: {err}")

    return {
        "status": "connected",
        "id": repo_record.id,
        "repository_name": repo_record.repository_name,
        "owner": repo_record.owner,
        "branch": repo_record.branch,
        "sync_status": repo_record.sync_status,
    }


@router.get("/github/connected-repos")
async def list_connected_github_repositories(
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Lists all connected GitHub repositories for current workspace.
    """
    repos = await get_connected_repositories(member.workspace_id, db)
    return [
        {
            "id": r.id,
            "repository_id": r.repository_id,
            "repository_name": r.repository_name,
            "owner": r.owner,
            "branch": r.branch,
            "default_branch": r.default_branch,
            "is_private": r.is_private,
            "sync_status": r.sync_status,
            "sync_config": r.sync_config_json,
            "last_synced_commit": r.last_synced_commit,
            "last_synced_at": r.last_synced_at.isoformat() if r.last_synced_at else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in repos
    ]


@router.delete("/github/connected-repos/{repo_id}")
async def disconnect_github_repository(
    repo_id: str,
    member: TeamMember = Depends(require_role(["owner", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Disconnects a connected repository.
    """
    success = await remove_connected_repository(member.workspace_id, repo_id, db)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connected repository not found.",
        )
    return {"status": "disconnected", "id": repo_id}


@router.post("/github/repositories/{repo_id}/sync")
async def trigger_repo_sync(
    repo_id: str,
    member: TeamMember = Depends(require_role(["owner", "admin"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Triggers asynchronous repository sync and vector indexing.
    Responds immediately with queued status.
    """
    from apps.api.src.services.github_sync_service import trigger_repository_sync
    return await trigger_repository_sync(
        workspace_id=member.workspace_id,
        repo_id=repo_id,
        db=db,
    )


class ExplainFileRequest(BaseModel):
    file_path: str
    repo_id: Optional[str] = None


@router.post("/github/explain-file")
async def explain_file_with_ai(
    payload: ExplainFileRequest,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    """
    Analyzes an indexed GitHub code file using RAG vector context and returns an AI explanation.
    """
    from apps.api.src.services.code_explanation_service import explain_github_file
    return await explain_github_file(
        workspace_id=member.workspace_id,
        file_path=payload.file_path,
        db=db,
        repo_id=payload.repo_id,
    )


# ==========================================
# GITHUB ISSUE CREATION FROM CONVERSATION
# ==========================================

class CreateIssuePayload(BaseModel):
    title: str
    description: str
    steps_to_reproduce: Optional[str] = None
    expected_behavior: Optional[str] = None
    actual_behavior: Optional[str] = None
    customer_context: Optional[str] = None
    priority: Optional[str] = "medium"
    environment: Optional[str] = None


@router.post("/github/conversations/{conv_id}/generate-issue-preview")
async def generate_issue_preview_from_conversation(
    conv_id: str,
    member: TeamMember = Depends(require_role(["owner", "admin", "agent"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Summarizes conversation transcript with AI and generates a structured issue preview.
    Does NOT create issue on GitHub without explicit agent approval.
    """
    from apps.api.src.services.github_issue_pr_service import generate_github_issue_preview
    return await generate_github_issue_preview(
        workspace_id=member.workspace_id,
        conversation_id=conv_id,
        db=db,
    )


@router.post("/github/repositories/{repo_id}/issues")
async def create_issue_on_github(
    repo_id: str,
    payload: CreateIssuePayload,
    member: TeamMember = Depends(require_role(["owner", "admin", "agent"])),
    db: AsyncSession = Depends(get_db),
):
    """
    Creates a GitHub issue on the selected repository upon explicit agent approval.
    """
    from apps.api.src.services.github_issue_pr_service import create_github_issue
    return await create_github_issue(
        workspace_id=member.workspace_id,
        repo_id=repo_id,
        issue_data=payload.model_dump(),
        db=db,
    )


# ==========================================
# GITHUB WEBHOOK ENDPOINT & SECURITY
# ==========================================

@router.post("/github/webhook")
async def receive_github_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    Receives incoming GitHub webhooks ('push', 'pull_request', 'issues').
    Verifies X-Hub-Signature-256 HMAC-SHA256 signature and queues background sync tasks.
    Responds immediately in <50ms.
    """
    from apps.api.src.services.github_webhook_service import (
        verify_github_webhook_signature,
        handle_github_webhook,
    )

    signature_header = request.headers.get("X-Hub-Signature-256")
    event_type = request.headers.get("X-GitHub-Event", "push")
    raw_bytes = await request.body()

    # 1. Cryptographic HMAC-SHA256 Signature Verification
    if not verify_github_webhook_signature(raw_bytes, signature_header):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid GitHub webhook HMAC-SHA256 signature.",
        )

    # 2. Parse JSON payload
    try:
        payload = json.loads(raw_bytes.decode("utf-8"))
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON payload.",
        )

    # 3. Process webhook event and queue background task
    return await handle_github_webhook(
        event_type=event_type,
        payload=payload,
        db=db,
    )






