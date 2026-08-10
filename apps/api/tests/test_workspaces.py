import pytest
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

@pytest.fixture(autouse=True)
async def setup_db():
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.mark.asyncio
async def test_workspace_setup_and_listing():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Register user
        reg_resp = await ac.post(
            "/auth/register",
            json={
                "email": "workspace_owner@example.com",
                "password": "Password123!",
                "name": "Workspace Owner",
            },
        )
        token = reg_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Setup Workspace
        setup_resp = await ac.post(
            "/workspaces/setup",
            json={
                "name": "Acme SaaS",
                "website_url": "https://acme.com",
                "industry": "SaaS & Tech",
                "brand_name": "Acme Bot",
                "primary_color": "#D4AF37",
                "greeting_message": "Welcome to Acme!",
                "plan_name": "Free",
            },
            headers=headers,
        )
        assert setup_resp.status_code == 200
        ws_data = setup_resp.json()
        assert ws_data["business"]["name"] == "Acme SaaS"
        assert ws_data["role"] == "owner"
        assert ws_data["widget_config"]["brand_name"] == "Acme Bot"

        # List user workspaces
        list_resp = await ac.get("/workspaces", headers=headers)
        assert list_resp.status_code == 200
        workspaces = list_resp.json()
        assert len(workspaces) == 1
        assert workspaces[0]["id"] == ws_data["id"]

        # Fetch details with workspace header
        detail_headers = {**headers, "X-Workspace-Id": ws_data["id"]}
        detail_resp = await ac.get(f"/workspaces/{ws_data['id']}", headers=detail_headers)
        assert detail_resp.status_code == 200
        assert detail_resp.json()["id"] == ws_data["id"]
