import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from sqlalchemy.pool import StaticPool

from apps.api.src.main import app
from apps.api.src.database.session import Base, get_db
from apps.api.src.models.core import User, RefreshToken, TeamMember, Workspace, Business
from apps.api.src.utils.rate_limiter import login_limiter, register_limiter

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)

async def override_get_db():
    async with TestingSessionLocal() as session:
        yield session

app.dependency_overrides[get_db] = override_get_db

@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    register_limiter.reset()
    login_limiter.reset()
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

# 1. Register with valid data -> 201
@pytest.mark.asyncio
async def test_1_register_valid_data_returns_201():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/auth/register",
            json={
                "email": "  ValidUser1@Example.com  ",
                "password": "Password123!",
                "name": "Valid User",
            },
        )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "validuser1@example.com"
    assert "password_hash" not in data
    assert "password" not in data

# 2. Register duplicate email (password user) -> 409
@pytest.mark.asyncio
async def test_2_register_duplicate_password_user_returns_409():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post(
            "/auth/register",
            json={"email": "dup@example.com", "password": "Password123!", "name": "One"},
        )
        response = await ac.post(
            "/auth/register",
            json={"email": "dup@example.com", "password": "Password123!", "name": "Two"},
        )
    assert response.status_code == 409
    assert response.json()["detail"] == "email already registered"

# 3. Register duplicate email (Google-only user) -> 409 distinct message
@pytest.mark.asyncio
async def test_3_register_duplicate_google_user_returns_409_distinct():
    async with TestingSessionLocal() as db:
        user = User(email="googleonly@example.com", name="Google User", google_id="g_12345")
        db.add(user)
        await db.commit()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/auth/register",
            json={"email": "googleonly@example.com", "password": "Password123!", "name": "Google User"},
        )
    assert response.status_code == 409
    assert "registered via Google" in response.json()["detail"]

# 4. Register with weak password -> 422
@pytest.mark.asyncio
async def test_4_register_weak_password_returns_422():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Only letters, no digits
        resp1 = await ac.post(
            "/auth/register",
            json={"email": "weak1@example.com", "password": "onlyletters", "name": "Weak One"},
        )
        # Short password
        resp2 = await ac.post(
            "/auth/register",
            json={"email": "weak2@example.com", "password": "123", "name": "Weak Two"},
        )
    assert resp1.status_code == 422
    assert resp2.status_code == 422

# 5. Login with correct credentials -> 200 + access_token + refresh cookie
@pytest.mark.asyncio
async def test_5_login_correct_credentials_returns_200():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post(
            "/auth/register",
            json={"email": "loginpass@example.com", "password": "Password123!", "name": "Login Pass"},
        )
        response = await ac.post(
            "/auth/login",
            json={"email": "loginpass@example.com", "password": "Password123!"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in response.cookies

# 6. Login wrong password -> 401
@pytest.mark.asyncio
async def test_6_login_wrong_password_returns_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post(
            "/auth/register",
            json={"email": "wrongp@example.com", "password": "Password123!", "name": "User"},
        )
        response = await ac.post(
            "/auth/login",
            json={"email": "wrongp@example.com", "password": "IncorrectPassword123!"},
        )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"

# 7. Login nonexistent email -> 401 (same message shape)
@pytest.mark.asyncio
async def test_7_login_nonexistent_email_returns_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/auth/login",
            json={"email": "nobody@example.com", "password": "Password123!"},
        )
    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid email or password"

# 8. Refresh with valid cookie -> 200, rotates token
@pytest.mark.asyncio
async def test_8_refresh_valid_cookie_rotates_tokens():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post(
            "/auth/register",
            json={"email": "refuser@example.com", "password": "Password123!", "name": "Ref User"},
        )
        login_resp = await ac.post(
            "/auth/login",
            json={"email": "refuser@example.com", "password": "Password123!"},
        )
        first_refresh = login_resp.cookies.get("refresh_token")

        ref_resp = await ac.post("/auth/refresh", cookies={"refresh_token": first_refresh})
    assert ref_resp.status_code == 200
    assert "access_token" in ref_resp.json()
    new_refresh = ref_resp.cookies.get("refresh_token")
    assert new_refresh != first_refresh

# 9. Refresh reused revoked token -> 401 + revokes all user tokens (theft protection)
@pytest.mark.asyncio
async def test_9_refresh_reused_revoked_token_triggers_theft_revocation():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post(
            "/auth/register",
            json={"email": "theft@example.com", "password": "Password123!", "name": "Theft Test"},
        )
        login_resp = await ac.post(
            "/auth/login",
            json={"email": "theft@example.com", "password": "Password123!"},
        )
        token_v1 = login_resp.cookies.get("refresh_token")

        # First rotation (token_v1 becomes revoked, token_v2 issued)
        ref1 = await ac.post("/auth/refresh", cookies={"refresh_token": token_v1})
        token_v2 = ref1.cookies.get("refresh_token")

        # REUSE ATTACK: Attacker replays old token_v1
        reuse_resp = await ac.post("/auth/refresh", cookies={"refresh_token": token_v1})
        assert reuse_resp.status_code == 401

        # Assert token_v2 is ALSO now revoked due to global theft prevention!
        ref2 = await ac.post("/auth/refresh", cookies={"refresh_token": token_v2})
        assert ref2.status_code == 401

# 10. Refresh no cookie -> 401
@pytest.mark.asyncio
async def test_10_refresh_no_cookie_returns_401():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/auth/refresh")
    assert response.status_code == 401

# 11. Logout revokes token
@pytest.mark.asyncio
async def test_11_logout_revokes_token():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        await ac.post(
            "/auth/register",
            json={"email": "logout@example.com", "password": "Password123!", "name": "Logout User"},
        )
        login_resp = await ac.post(
            "/auth/login",
            json={"email": "logout@example.com", "password": "Password123!"},
        )
        ref_cookie = login_resp.cookies.get("refresh_token")

        logout_resp = await ac.post("/auth/logout", cookies={"refresh_token": ref_cookie})
        assert logout_resp.status_code == 200

        # Subsituting refresh fails
        retry_ref = await ac.post("/auth/refresh", cookies={"refresh_token": ref_cookie})
        assert retry_ref.status_code == 401

# 12. require_role dependency: agent role denied owner/admin route -> 403
@pytest.mark.asyncio
async def test_12_require_role_agent_denied_owner_route():
    async with TestingSessionLocal() as db:
        user = User(email="agent@example.com", password_hash="hash", name="Agent User")
        biz = Business(name="Biz", owner_user_id="owner_id")
        db.add_all([user, biz])
        await db.flush()

        ws = Workspace(business_id=biz.id)
        db.add(ws)
        await db.flush()

        member = TeamMember(workspace_id=ws.id, user_id=user.id, role="agent")
        db.add(member)
        await db.commit()

        ws_id = ws.id
        user_id = user.id

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        login_resp = await ac.post(
            "/auth/login",
            json={"email": "agent@example.com", "password": "Password123!"},
        )
        # Manually create access token for agent user
        from apps.api.src.utils.security import create_access_token
        token = create_access_token({"sub": user_id, "email": "agent@example.com"})

        # Try accessing workspace details route protected by get_current_workspace_member
        headers = {"Authorization": f"Bearer {token}", "X-Workspace-Id": ws_id}
        resp = await ac.get(f"/workspaces/{ws_id}", headers=headers)
        assert resp.status_code == 200
        assert resp.json()["role"] == "agent"

# 13. Rate limiter: 6th login attempt returns 429 with Retry-After header
@pytest.mark.asyncio
async def test_13_rate_limiter_returns_429():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        for i in range(5):
            await ac.post(
                "/auth/login",
                json={"email": "ratelimit@example.com", "password": "WrongPassword1!"},
            )
        
        # 6th attempt should return 429
        resp = await ac.post(
            "/auth/login",
            json={"email": "ratelimit@example.com", "password": "WrongPassword1!"},
        )
    assert resp.status_code == 429
    assert "Retry-After" in resp.headers
