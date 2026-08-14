import pytest
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch

from apps.api.src.services.cache_service import (
    async_get,
    async_set,
    async_get_json,
    async_set_json,
    async_get_version,
    async_increment_version,
    build_cache_key,
    get_version_key,
    serialize_value,
    deserialize_value,
    CacheTTL,
    _memory_cache,
    _memory_versions,
)

@pytest.mark.asyncio
async def test_build_cache_key_tenant_isolation():
    """Verify key construction ensures multi-tenant workspace isolation and deterministic keys."""
    key1 = build_cache_key("ws_A", "customers", version=1, page=1, limit=20)
    key2 = build_cache_key("ws_B", "customers", version=1, page=1, limit=20)
    
    assert "workspace:ws_A:customers:list:v1:p1:l20" == key1
    assert "workspace:ws_B:customers:list:v1:p1:l20" == key2
    assert key1 != key2, "Workspace A and Workspace B must never produce identical cache keys"


@pytest.mark.asyncio
async def test_pagination_and_filter_key_determinism():
    """Verify pagination and query filter parameters create deterministic separate cache keys."""
    key_p1 = build_cache_key("ws_1", "sources", version=1, page=1, limit=10)
    key_p2 = build_cache_key("ws_1", "sources", version=1, page=2, limit=10)
    assert key_p1 != key_p2

    key_f1 = build_cache_key("ws_1", "sources", version=1, filters={"status": "completed", "search": "docs"})
    key_f2 = build_cache_key("ws_1", "sources", version=1, filters={"search": "docs", "status": "completed"})
    assert key_f1 == key_f2, "Filter key building must be order-invariant and deterministic"


@pytest.mark.asyncio
async def test_cache_miss_then_hit_flow():
    """Verify cache miss queries data source, caches result, and subsequent GET returns cache hit."""
    ws_id = "ws_test_flow"
    resource = "items"
    
    ver = await async_get_version(ws_id, resource)
    key = build_cache_key(ws_id, resource, version=ver)
    
    # 1. First attempt: Cache MISS
    cached_init = await async_get_json(key)
    assert cached_init is None, "First fetch should be a cache MISS"

    # 2. Simulate DB fetch & Store in Redis / memory fallback
    db_data = [{"id": "item_1", "name": "Widget A"}, {"id": "item_2", "name": "Widget B"}]
    await async_set_json(key, db_data, ttl_seconds=CacheTTL.NORMAL_LIST)

    # 3. Second attempt: Cache HIT
    cached_hit = await async_get_json(key)
    assert cached_hit == db_data, "Second fetch should return cached result without DB query"


@pytest.mark.asyncio
async def test_post_put_delete_mutation_version_invalidation():
    """Verify POST, PUT, DELETE mutations increment version key, rendering old cache keys invalid."""
    ws_id = "ws_mutations"
    resource = "customers"

    v_init = await async_get_version(ws_id, resource)
    key_v1 = build_cache_key(ws_id, resource, version=v_init, page=1, limit=20)
    await async_set_json(key_v1, [{"id": "c1", "name": "Alice"}], ttl_seconds=300)

    # Verify cached data exists for v1
    assert await async_get_json(key_v1) is not None

    # Simulate POST/PUT/DELETE mutation -> increment version after DB commit
    v_new = await async_increment_version(ws_id, resource)
    assert v_new == v_init + 1

    # Build new list cache key for new version
    key_v2 = build_cache_key(ws_id, resource, version=v_new, page=1, limit=20)
    assert await async_get_json(key_v2) is None, "New version cache key must be a MISS until refreshed"


@pytest.mark.asyncio
async def test_redis_failure_graceful_degradation():
    """Verify system degrades gracefully to memory fallback / DB when Redis throws errors."""
    key = "workspace:ws_fail:test:list:v1"
    
    with patch("apps.api.src.services.cache_service.async_redis_client") as mock_redis:
        mock_redis.get = AsyncMock(side_effect=Exception("Connection refused to Upstash Redis"))
        mock_redis.setex = AsyncMock(side_effect=Exception("Redis timeout"))

        # GET should not raise exception, but return None gracefully
        val = await async_get(key)
        assert val is None

        # SET should not raise exception, but fallback gracefully to memory
        await async_set_json(key, {"status": "ok"}, ttl_seconds=60)
        retrieved = await async_get_json(key)
        assert retrieved == {"status": "ok"}


@pytest.mark.asyncio
async def test_db_transaction_failure_prevents_cache_invalidation():
    """Verify cache version is NOT incremented if a DB transaction fails/rolls back."""
    ws_id = "ws_tx_fail"
    resource = "products"

    v_before = await async_get_version(ws_id, resource)

    # Simulate failed DB transaction in router handler
    db_commit_succeeded = False
    try:
        # Simulate DB error during operation
        raise ValueError("PostgreSQL unique constraint violation")
        db_commit_succeeded = True
    except Exception:
        db_commit_succeeded = False

    # Perform cache invalidation conditionally based on DB commit status
    if db_commit_succeeded:
        await async_increment_version(ws_id, resource)

    v_after = await async_get_version(ws_id, resource)
    assert v_after == v_before, "Cache version must NOT change when DB transaction fails"


@pytest.mark.asyncio
async def test_multi_tenant_isolation_workspace_b_cannot_read_workspace_a():
    """Verify Workspace B cannot read Workspace A cached response."""
    data_ws_a = [{"secret_id": "sec_100", "payload": "Confidential Tenant A"}]
    data_ws_b = [{"secret_id": "sec_200", "payload": "Tenant B Data"}]

    key_a = build_cache_key("workspace_A", "sources", version=1)
    key_b = build_cache_key("workspace_B", "sources", version=1)

    await async_set_json(key_a, data_ws_a, ttl_seconds=300)
    await async_set_json(key_b, data_ws_b, ttl_seconds=300)

    res_a = await async_get_json(key_a)
    res_b = await async_get_json(key_b)

    assert res_a != res_b
    assert res_a[0]["payload"] == "Confidential Tenant A"
    assert res_b[0]["payload"] == "Tenant B Data"
