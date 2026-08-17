import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from apps.api.src.utils.encryption import encrypt_token, decrypt_token
from apps.api.src.services.github_auth_service import get_github_auth_url
from apps.api.src.models.core import GitHubIntegration, Workspace, Business, User, TeamMember, generate_uuid
from apps.api.src.utils.security import create_access_token


def test_encryption_utility():
    """
    Test token encryption and decryption symmetry and non-exposure of plaintext.
    """
    raw_token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz"
    encrypted = encrypt_token(raw_token)
    assert encrypted != raw_token
    assert "ghp_12345" not in encrypted
    
    decrypted = decrypt_token(encrypted)
    assert decrypted == raw_token


def test_get_github_auth_url():
    """
    Test GitHub OAuth state parameter generation.
    """
    workspace_id = "test-ws-123"
    auth_url = get_github_auth_url(workspace_id)
    assert "https://github.com/login/oauth/authorize" in auth_url
    assert "client_id=" in auth_url
    assert "state=" in auth_url
    assert "scope=repo,read:user,user:email" in auth_url


@pytest.mark.asyncio
async def test_github_connection_api_endpoints(db_session: AsyncSession):
    """
    Test /integrations/github/connection GET and DELETE endpoints.
    Verifies tokens are never returned in response payload.
    """
    from apps.api.src.main import app

    # 1. Setup mock workspace and user
    user_id = generate_uuid()
    ws_id = generate_uuid()
    
    user = User(id=user_id, email=f"gh_owner_{user_id[:6]}@example.com", name="GH Owner")
    db_session.add(user)
    
    biz = Business(id=generate_uuid(), name="GH Org", owner_user_id=user_id)
    db_session.add(biz)
    
    ws = Workspace(id=ws_id, business_id=biz.id)
    db_session.add(ws)
    
    tm = TeamMember(id=generate_uuid(), workspace_id=ws_id, user_id=user_id, role="owner")
    db_session.add(tm)

    # 2. Add mock GitHub integration
    gh_integration = GitHubIntegration(
        id=generate_uuid(),
        workspace_id=ws_id,
        github_user_id="998877",
        github_username="octocat_test",
        github_avatar_url="https://avatars.githubusercontent.com/u/998877",
        access_token_encrypted=encrypt_token("ghp_secret_access_token_mock"),
        status="connected",
    )
    db_session.add(gh_integration)
    await db_session.commit()

    # 3. Request connection status via API client
    jwt_token = create_access_token({"sub": user_id})
    headers = {
        "Authorization": f"Bearer {jwt_token}",
        "X-Workspace-Id": ws_id,
    }

    async with AsyncClient(app=app, base_url="http://test") as ac:
        res = await ac.get("/integrations/github/connection", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert data is not None
        assert data["github_username"] == "octocat_test"
        assert data["status"] == "connected"
        # CRITICAL SECURITY CHECK: Ensure plaintext or encrypted tokens are NEVER in API response
        assert "access_token" not in data
        assert "access_token_encrypted" not in data
        assert "ghp_secret" not in res.text

        # 4. Disconnect GitHub connection via DELETE
        res_del = await ac.delete("/integrations/github/connection", headers=headers)
        assert res_del.status_code == 200
        assert res_del.json()["status"] == "disconnected"

        # 5. Verify GET now returns null
        res_after = await ac.get("/integrations/github/connection", headers=headers)
        assert res_after.status_code == 200
        assert res_after.json() is None
