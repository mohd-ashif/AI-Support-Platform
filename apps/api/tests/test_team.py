import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import StaticPool

from apps.api.src.main import app
from apps.api.src.database.session import Base, get_db

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
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_team_management_and_rbac():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 1. Register owner
        reg_resp = await ac.post(
            "/auth/register",
            json={"email": "team_owner@example.com", "password": "Password123!", "name": "Team Owner"},
        )
        login_resp = await ac.post(
            "/auth/login",
            json={"email": "team_owner@example.com", "password": "Password123!"},
        )
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 2. Setup workspace
        setup_resp = await ac.post(
            "/workspaces/setup",
            json={"name": "Team Test Corp"},
            headers=headers,
        )
        ws_id = setup_resp.json()["id"]
        headers["X-Workspace-Id"] = ws_id

        # 3. Seed demo role accounts
        seed_resp = await ac.post(f"/workspaces/{ws_id}/team/seed-demo", headers=headers)
        assert seed_resp.status_code == 200
        accounts = seed_resp.json()["accounts"]
        assert len(accounts) == 3

        # 4. List team members
        list_resp = await ac.get(f"/workspaces/{ws_id}/team", headers=headers)
        assert list_resp.status_code == 200
        members = list_resp.json()
        assert len(members) >= 3

        # 5. Invite member
        invite_resp = await ac.post(
            f"/workspaces/{ws_id}/team/invite",
            json={"email": "new_agent@example.com", "role": "agent"},
            headers=headers,
        )
        assert invite_resp.status_code == 200
        assert invite_resp.json()["role"] == "agent"
