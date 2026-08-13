import pytest
import pytest_asyncio
import json
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select

from apps.api.src.main import app
from apps.api.src.database.session import AsyncSessionLocal, engine
from apps.api.src.models.core import (
    Base,
    User,
    Business,
    Workspace,
    TeamMember,
    WidgetConfig,
    Plan,
    Subscription,
    ProcessedStripeEvent,
    SourceWeb,
)
from apps.api.src.utils.security import hash_password, create_access_token
from apps.api.src.seed_plans import seed_plans

@pytest_asyncio.fixture(scope="module", autouse=True)
async def setup_database():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_plans()
    yield

@pytest_asyncio.fixture
async def async_client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

@pytest_asyncio.fixture
async def auth_headers():
    async with AsyncSessionLocal() as db:
        user = User(
            email="phase3_test_user@example.com",
            name="Phase3 User",
            password_hash=hash_password("password123"),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

        token = create_access_token({"sub": user.id, "email": user.email})
        return {"Authorization": f"Bearer {token}", "user_id": user.id}

@pytest.mark.asyncio
async def test_01_create_workspace_multi_row_transaction(async_client: AsyncClient, auth_headers: dict):
    headers = {"Authorization": auth_headers["Authorization"]}
    payload = {
        "business_name": "Acme MultiRow Inc",
        "website_url": "acme-multirow.com",
        "industry": "SaaS/Tech",
        "logo_url": "https://cloudinary.com/acme.png",
    }
    response = await async_client.post("/workspaces", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    data = response.json()

    assert data["status"] == "onboarding"
    ws_id = data["id"]
    biz_id = data["business_id"]

    # Verify all 4 rows exist in DB
    async with AsyncSessionLocal() as db:
        biz = (await db.execute(select(Business).where(Business.id == biz_id))).scalars().first()
        ws = (await db.execute(select(Workspace).where(Workspace.id == ws_id))).scalars().first()
        tm = (await db.execute(select(TeamMember).where(TeamMember.workspace_id == ws_id))).scalars().first()
        wc = (await db.execute(select(WidgetConfig).where(WidgetConfig.workspace_id == ws_id))).scalars().first()

        assert biz is not None
        assert ws is not None
        assert tm is not None
        assert wc is not None
        assert tm.role == "owner"
        assert wc.brand_name == "Acme MultiRow Inc"

@pytest.mark.asyncio
async def test_02_create_workspace_idempotent_onboarding(async_client: AsyncClient, auth_headers: dict):
    headers = {"Authorization": auth_headers["Authorization"]}
    payload = {
        "business_name": "Acme Duplicate Try",
        "website_url": "acme-duplicate.com",
        "industry": "Finance",
    }
    # Second call by same user while status is onboarding returns existing workspace
    response = await async_client.post("/workspaces", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["business"]["name"] == "Acme MultiRow Inc"

@pytest.mark.asyncio
async def test_03_website_url_normalization(async_client: AsyncClient, auth_headers: dict):
    from apps.api.src.services.workspace_service import normalize_and_validate_url
    normalized = normalize_and_validate_url("acme-test.io")
    assert normalized == "https://acme-test.io"

    normalized_https = normalize_and_validate_url("https://already-https.com")
    assert normalized_https == "https://already-https.com"

@pytest.mark.asyncio
async def test_04_checkout_free_trial_short_circuit(async_client: AsyncClient, auth_headers: dict):
    headers = {"Authorization": auth_headers["Authorization"]}
    
    # Get user workspace
    ws_res = await async_client.get("/workspaces", headers=headers)
    ws_id = ws_res.json()[0]["id"]

    payload = {
        "workspace_id": ws_id,
        "plan_id": "plan_free_trial",
        "billing_cycle": "monthly",
    }
    response = await async_client.post("/billing/checkout", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["redirect"] == "/dashboard"

    # Verify workspace status updated to trialing
    async with AsyncSessionLocal() as db:
        ws = (await db.execute(select(Workspace).where(Workspace.id == ws_id))).scalars().first()
        sub = (await db.execute(select(Subscription).where(Subscription.workspace_id == ws_id))).scalars().first()

        assert ws.status == "trialing"
        assert sub is not None
        assert sub.status == "trialing"
        assert sub.stripe_customer_id is None

@pytest.mark.asyncio
async def test_05_checkout_paid_plan_stripe_session(async_client: AsyncClient, auth_headers: dict):
    headers = {"Authorization": auth_headers["Authorization"]}
    ws_res = await async_client.get("/workspaces", headers=headers)
    ws_id = ws_res.json()[0]["id"]

    payload = {
        "workspace_id": ws_id,
        "plan_id": "plan_pro",
        "billing_cycle": "monthly",
    }
    response = await async_client.post("/billing/checkout", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert "redirect" in data
    assert "/onboarding/subscription/success" in data["redirect"] or "stripe.com" in data["redirect"]

@pytest.mark.asyncio
async def test_06_webhook_checkout_session_completed(async_client: AsyncClient, auth_headers: dict):
    ws_res = await async_client.get("/workspaces", headers={"Authorization": auth_headers["Authorization"]})
    ws_id = ws_res.json()[0]["id"]

    event_payload = {
        "id": "evt_test_completed_101",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "customer": "cus_test_123",
                "subscription": "sub_test_456",
                "metadata": {
                    "workspace_id": ws_id,
                    "plan_id": "plan_pro",
                },
            }
        },
    }

    response = await async_client.post("/billing/webhook", json=event_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    # Verify DB subscription active
    async with AsyncSessionLocal() as db:
        ws = (await db.execute(select(Workspace).where(Workspace.id == ws_id))).scalars().first()
        sub = (await db.execute(select(Subscription).where(Subscription.workspace_id == ws_id))).scalars().first()
        proc = (await db.execute(select(ProcessedStripeEvent).where(ProcessedStripeEvent.event_id == "evt_test_completed_101"))).scalars().first()

        assert ws.status == "active"
        assert sub.status == "active"
        assert sub.stripe_customer_id == "cus_test_123"
        assert proc is not None

@pytest.mark.asyncio
async def test_07_webhook_idempotency_duplicate_event(async_client: AsyncClient):
    event_payload = {
        "id": "evt_test_completed_101",
        "type": "checkout.session.completed",
        "data": {"object": {}},
    }

    # Duplicate call returns 200 immediately
    response = await async_client.post("/billing/webhook", json=event_payload)
    assert response.status_code == 200
    assert response.json()["detail"] == "Event already processed"

@pytest.mark.asyncio
async def test_08_webhook_invalid_payload_error(async_client: AsyncClient):
    response = await async_client.post("/billing/webhook", content="not valid json")
    assert response.status_code == 400

@pytest.mark.asyncio
async def test_09_webhook_payment_failed(async_client: AsyncClient, auth_headers: dict):
    ws_res = await async_client.get("/workspaces", headers={"Authorization": auth_headers["Authorization"]})
    ws_id = ws_res.json()[0]["id"]

    event_payload = {
        "id": "evt_test_failed_202",
        "type": "invoice.payment_failed",
        "data": {
            "object": {
                "customer": "cus_test_123",
            }
        },
    }

    response = await async_client.post("/billing/webhook", json=event_payload)
    assert response.status_code == 200

    async with AsyncSessionLocal() as db:
        ws = (await db.execute(select(Workspace).where(Workspace.id == ws_id))).scalars().first()
        assert ws.status == "past_due"

@pytest.mark.asyncio
async def test_10_onboarding_status_fresh_workspace(async_client: AsyncClient, auth_headers: dict):
    headers = {"Authorization": auth_headers["Authorization"]}
    response = await async_client.get("/onboarding/status", headers=headers)
    assert response.status_code == 200
    data = response.json()

    assert data["total"] == 5
    assert len(data["steps"]) == 5
    assert data["completed_count"] == 0
    assert data["percent"] == 0

@pytest.mark.asyncio
async def test_11_onboarding_status_after_adding_source(async_client: AsyncClient, auth_headers: dict):
    headers = {"Authorization": auth_headers["Authorization"]}
    ws_res = await async_client.get("/workspaces", headers=headers)
    ws_id = ws_res.json()[0]["id"]

    # Insert a web source row
    async with AsyncSessionLocal() as db:
        web_src = SourceWeb(
            workspace_id=ws_id,
            url="https://docs.acme.com",
            status="ready",
        )
        db.add(web_src)
        await db.commit()

    headers_with_ws = {**headers, "X-Workspace-Id": ws_id}
    response = await async_client.get("/onboarding/status", headers=headers_with_ws)
    assert response.status_code == 200
    data = response.json()

    assert data["steps"][0]["key"] == "has_sources"
    assert data["steps"][0]["completed"] is True
    assert data["completed_count"] == 1
    assert data["percent"] == 20

@pytest.mark.asyncio
async def test_12_get_subscription_dynamic_data(async_client: AsyncClient, auth_headers: dict):
    headers = {"Authorization": auth_headers["Authorization"]}
    ws_res = await async_client.get("/workspaces", headers=headers)
    ws_id = ws_res.json()[0]["id"]

    headers_with_ws = {**headers, "X-Workspace-Id": ws_id}
    response = await async_client.get("/billing/subscription", headers=headers_with_ws)
    assert response.status_code == 200
    data = response.json()

    assert "plan_name" in data
    assert "messages_used" in data
    assert "seats_used" in data
    assert data["workspace_id"] == ws_id
    assert isinstance(data["messages_used"], int)
    assert isinstance(data["seats_used"], int)

@pytest.mark.asyncio
async def test_13_webhook_subscription_updated(async_client: AsyncClient, auth_headers: dict):
    ws_res = await async_client.get("/workspaces", headers={"Authorization": auth_headers["Authorization"]})
    ws_id = ws_res.json()[0]["id"]

    event_payload = {
        "id": "evt_test_updated_303",
        "type": "customer.subscription.updated",
        "data": {
            "object": {
                "id": "sub_test_456",
                "customer": "cus_test_123",
                "status": "active",
                "current_period_end": 1770000000,
                "metadata": {
                    "workspace_id": ws_id,
                },
            }
        },
    }

    response = await async_client.post("/billing/webhook", json=event_payload)
    assert response.status_code == 200
    assert response.json()["status"] == "success"

    async with AsyncSessionLocal() as db:
        sub = (await db.execute(select(Subscription).where(Subscription.workspace_id == ws_id))).scalars().first()
        assert sub is not None
        assert sub.status == "active"

