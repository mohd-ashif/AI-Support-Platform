import os
import logging
import httpx
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from fastapi import HTTPException, status

from apps.api.src.config.settings import settings
from apps.api.src.models.core import GitHubIntegration, utc_now
from apps.api.src.utils.encryption import encrypt_token, decrypt_token
from apps.api.src.utils.security import create_access_token, decode_access_token

logger = logging.getLogger("github_auth_service")

GITHUB_OAUTH_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_OAUTH_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_USER_API_URL = "https://api.github.com/user"


def get_github_auth_url(workspace_id: str) -> str:
    """
    Generates a secure GitHub OAuth authorization URL with signed state token containing workspace_id.
    """
    client_id = os.getenv("GITHUB_CLIENT_ID") or settings.GITHUB_CLIENT_ID
    callback_url = os.getenv("GITHUB_CALLBACK_URL") or settings.GITHUB_CALLBACK_URL

    if not client_id or client_id == "mock-github-client-id":
        logger.warning("GITHUB_CLIENT_ID is not configured or is using mock defaults.")

    state_token = create_access_token({"workspace_id": workspace_id, "type": "github_oauth_state"})
    scope = "repo,read:user,user:email"
    auth_url = (
        f"{GITHUB_OAUTH_AUTHORIZE_URL}?"
        f"client_id={client_id}&"
        f"redirect_uri={callback_url}&"
        f"scope={scope}&"
        f"state={state_token}"
    )
    return auth_url


async def handle_github_callback(
    code: str,
    state: str,
    db: AsyncSession,
) -> GitHubIntegration:
    """
    Verifies OAuth state parameter, exchanges authorization code for access token,
    fetches GitHub user profile, encrypts token, and persists GitHubIntegration model.
    """
    # 1. Decode & verify state token
    state_data = decode_access_token(state)
    if not state_data or state_data.get("type") != "github_oauth_state" or "workspace_id" not in state_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state parameter. Please restart GitHub connection.",
        )

    workspace_id = state_data["workspace_id"]

    # 2. Exchange code for access token with GitHub
    async with httpx.AsyncClient(timeout=15.0) as client:
        client_id = os.getenv("GITHUB_CLIENT_ID") or settings.GITHUB_CLIENT_ID
        client_secret = os.getenv("GITHUB_CLIENT_SECRET") or settings.GITHUB_CLIENT_SECRET
        redirect_uri = os.getenv("GITHUB_CALLBACK_URL") or settings.GITHUB_CALLBACK_URL

        token_response = await client.post(
            GITHUB_OAUTH_TOKEN_URL,
            data={
                "client_id": client_id,
                "client_secret": client_secret,
                "code": code,
                "redirect_uri": redirect_uri,
            },
            headers={"Accept": "application/json"},
        )
        
        if token_response.status_code != 200:
            logger.error(f"GitHub token exchange failed with status {token_response.status_code}: {token_response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to exchange authorization code with GitHub.",
            )

        token_data = token_response.json()
        access_token = token_data.get("access_token")
        if not access_token:
            error_desc = token_data.get("error_description", "No access token returned")
            logger.error(f"GitHub OAuth error: {error_desc}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"GitHub OAuth error: {error_desc}",
            )

        refresh_token = token_data.get("refresh_token")
        expires_in = token_data.get("expires_in")
        token_expires_at = None
        if expires_in:
            token_expires_at = datetime.fromtimestamp(datetime.now(timezone.utc).timestamp() + int(expires_in), tz=timezone.utc)

        # 3. Fetch GitHub User Profile
        user_response = await client.get(
            GITHUB_USER_API_URL,
            headers={
                "Authorization": f"token {access_token}",
                "Accept": "application/vnd.github.v3+json",
                "User-Agent": "SupportAI-App",
            },
        )
        if user_response.status_code != 200:
            logger.error(f"Failed to fetch GitHub user profile: {user_response.text}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to fetch GitHub user account details.",
            )

        github_user = user_response.json()

    github_user_id = str(github_user.get("id"))
    github_username = github_user.get("login", "unknown")
    github_avatar_url = github_user.get("avatar_url")

    # 4. Encrypt Access & Refresh Tokens
    encrypted_access_token = encrypt_token(access_token)
    encrypted_refresh_token = encrypt_token(refresh_token) if refresh_token else None

    # 5. Check if integration exists for this workspace
    res = await db.execute(
        select(GitHubIntegration).where(GitHubIntegration.workspace_id == workspace_id)
    )
    existing_integration = res.scalars().first()

    if existing_integration:
        existing_integration.github_user_id = github_user_id
        existing_integration.github_username = github_username
        existing_integration.github_avatar_url = github_avatar_url
        existing_integration.access_token_encrypted = encrypted_access_token
        existing_integration.refresh_token_encrypted = encrypted_refresh_token
        existing_integration.token_expires_at = token_expires_at
        existing_integration.status = "connected"
        existing_integration.updated_at = utc_now()
        integration = existing_integration
    else:
        integration = GitHubIntegration(
            workspace_id=workspace_id,
            github_user_id=github_user_id,
            github_username=github_username,
            github_avatar_url=github_avatar_url,
            access_token_encrypted=encrypted_access_token,
            refresh_token_encrypted=encrypted_refresh_token,
            token_expires_at=token_expires_at,
            status="connected",
        )
        db.add(integration)

    await db.commit()
    await db.refresh(integration)
    logger.info(f"Successfully connected GitHub user '{github_username}' for workspace '{workspace_id}'")
    return integration


async def get_github_integration(workspace_id: str, db: AsyncSession) -> Optional[GitHubIntegration]:
    """
    Fetches active GitHub integration record for a given workspace.
    """
    res = await db.execute(
        select(GitHubIntegration).where(
            GitHubIntegration.workspace_id == workspace_id,
            GitHubIntegration.status == "connected",
        )
    )
    return res.scalars().first()


async def get_decrypted_access_token(workspace_id: str, db: AsyncSession) -> str:
    """
    Retrieves and decrypts the GitHub access token for a workspace.
    """
    integration = await get_github_integration(workspace_id, db)
    if not integration or not integration.access_token_encrypted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No connected GitHub integration found for this workspace. Please connect GitHub.",
        )
    decrypted = decrypt_token(integration.access_token_encrypted)
    if not decrypted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to decrypt GitHub access token.",
        )
    return decrypted


async def disconnect_github_integration(workspace_id: str, db: AsyncSession) -> bool:
    """
    Revokes and deletes GitHub integration record for a given workspace.
    """
    res = await db.execute(
        select(GitHubIntegration).where(GitHubIntegration.workspace_id == workspace_id)
    )
    integration = res.scalars().first()
    if not integration:
        return False

    await db.delete(integration)
    await db.commit()
    logger.info(f"Disconnected GitHub integration for workspace '{workspace_id}'")
    return True
