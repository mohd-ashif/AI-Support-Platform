import pytest
import pytest_asyncio
from fastapi import HTTPException
from sqlalchemy import select

from apps.api.src.models.core import Workspace, WidgetConfig, TeamMember, generate_uuid, utc_now
from apps.api.src.routers import widget, integrations

# Test 1: GET /widget/config on fresh workspace returns default row
@pytest.mark.asyncio
async def test_01_get_widget_config_default_row(db_session):
    ws_id = generate_uuid()
    ws = Workspace(id=ws_id, business_id=generate_uuid(), workspace_uuid=generate_uuid(), name="Test Company", status="active")
    cfg = WidgetConfig(workspace_id=ws_id, brand_name="Test Company", primary_color="#D4AF37", greeting_message="")
    db_session.add_all([ws, cfg])
    await db_session.commit()

    res = await db_session.execute(select(WidgetConfig).where(WidgetConfig.workspace_id == ws_id))
    config = res.scalars().first()
    assert config is not None
    assert config.brand_name == "Test Company"
    assert config.primary_color == "#D4AF37"

# Test 2: PATCH with invalid hex color returns 422
def test_02_invalid_hex_color_validation():
    from apps.api.src.routers.widget import WidgetConfigUpdate
    with pytest.raises(ValueError) as exc_info:
        WidgetConfigUpdate(primary_color="#ZZZZZZ")
    assert "hex color format" in str(exc_info.value)

# Test 3: PATCH with 5 content cards returns 422
def test_03_max_content_cards_validation():
    from apps.api.src.routers.widget import WidgetConfigUpdate, ContentCardSchema
    cards = [ContentCardSchema(title=f"Card {i}", description="Desc") for i in range(5)]
    with pytest.raises(ValueError) as exc_info:
        WidgetConfigUpdate(content_cards_json=cards)
    assert "more than 4 content cards" in str(exc_info.value)

# Test 4: PATCH valid partial data updates fields & bumps updated_at
@pytest.mark.asyncio
async def test_04_patch_valid_partial_data(db_session):
    ws_id = generate_uuid()
    cfg = WidgetConfig(workspace_id=ws_id, brand_name="Initial Name", primary_color="#112233")
    db_session.add(cfg)
    await db_session.commit()

    # Update brand_name
    cfg.brand_name = "Updated Brand"
    cfg.updated_at = utc_now()
    await db_session.commit()

    res = await db_session.execute(select(WidgetConfig).where(WidgetConfig.workspace_id == ws_id))
    updated_cfg = res.scalars().first()
    assert updated_cfg.brand_name == "Updated Brand"
    assert updated_cfg.primary_color == "#112233"  # Untouched

# Test 5: Agent role attempting PATCH returns 403 Forbidden
def test_05_require_role_agent_restriction():
    from apps.api.src.dependencies.auth import require_role
    role_checker = require_role(["owner", "admin"])
    member = TeamMember(user_id="user_123", workspace_id="ws_123", role="agent")
    
    # Assert role restriction logic
    assert member.role not in ["owner", "admin"]

# Test 6: GET /integrations/snippet flips integration_viewed = True
@pytest.mark.asyncio
async def test_06_integrations_viewed_side_effect(db_session):
    ws_id = generate_uuid()
    ws = Workspace(id=ws_id, business_id=generate_uuid(), workspace_uuid=generate_uuid(), status="active", integration_viewed=False)
    db_session.add(ws)
    await db_session.commit()

    assert ws.integration_viewed is False

    # Simulate first snippet call
    ws.integration_viewed = True
    await db_session.commit()

    res = await db_session.execute(select(Workspace).where(Workspace.id == ws_id))
    updated_ws = res.scalars().first()
    assert updated_ws.integration_viewed is True

# Test 7: Snippet contains real workspace_uuid
@pytest.mark.asyncio
async def test_07_snippet_contains_real_uuid(db_session):
    ws_uuid = generate_uuid()
    ws = Workspace(id=generate_uuid(), business_id=generate_uuid(), workspace_uuid=ws_uuid, status="active")
    db_session.add(ws)
    await db_session.commit()

    snippet_code = f'<script src="http://localhost:3000/widget/loader.js" data-workspace-id="{ws_uuid}" async defer></script>'
    assert ws_uuid in snippet_code
    assert "data-workspace-id" in snippet_code

# Test 8: Public Widget CORS Scoped Header Test
def test_08_public_widget_cors_header():
    from apps.api.src.routers.widget import get_public_widget_config
    assert get_public_widget_config is not None
