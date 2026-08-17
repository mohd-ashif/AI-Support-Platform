import json
import logging
import time
import hashlib
from typing import Optional, Any, Dict, Union
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID

from apps.api.src.config.settings import settings

logger = logging.getLogger("cache_service")

# TTL Constants (in seconds)
class CacheTTL:
    STATIC_REFERENCE = 1800  # 30 minutes
    NORMAL_LIST = 300       # 5 minutes
    WIDGET_CONFIG = 60      # 60 seconds
    ANALYTICS = 300         # 5 minutes

# In-memory dictionary fallbacks when Redis is unavailable or unconfigured
_memory_cache: Dict[str, tuple[Any, float]] = {}
_memory_versions: Dict[str, int] = {}

# Redis Client Setup (Support both Async & Sync operations with fallback)
async_redis_client = None
sync_redis_client = None

try:
    import redis.asyncio as aioredis
    redis_url = getattr(settings, "REDIS_URL", "")
    if redis_url and not redis_url.startswith("mock"):
        async_redis_client = aioredis.from_url(redis_url, decode_responses=True)
    else:
        async_redis_client = None
except Exception as e:
    logger.warning(f"[CACHE_WARN] Async Redis client setup note: {e}")
    async_redis_client = None

try:
    import redis
    redis_url = getattr(settings, "REDIS_URL", "")
    if redis_url and not redis_url.startswith("mock"):
        sync_redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
    else:
        sync_redis_client = None
except Exception as e:
    logger.warning(f"[CACHE_WARN] Sync Redis client setup note: {e}")
    sync_redis_client = None


class CustomJSONEncoder(json.JSONEncoder):
    """Handles serialization of datetime, UUID, Decimal, and objects with dict/model_dump methods."""
    def default(self, obj: Any) -> Any:
        if isinstance(obj, (datetime, date)):
            return obj.isoformat()
        if isinstance(obj, UUID):
            return str(obj)
        if isinstance(obj, Decimal):
            return float(obj)
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        if hasattr(obj, "dict"):
            return obj.dict()
        return super().default(obj)


def serialize_value(val: Any) -> str:
    """Serializes Python structures to JSON using CustomJSONEncoder."""
    return json.dumps(val, cls=CustomJSONEncoder)


def deserialize_value(val_str: str) -> Any:
    """Deserializes JSON string to Python structures."""
    return json.loads(val_str)


def build_cache_key(
    workspace_id: str,
    resource: str,
    version: int = 1,
    page: Optional[int] = None,
    limit: Optional[int] = None,
    filters: Optional[dict] = None,
) -> str:
    """
    Constructs a deterministic multi-tenant cache key.
    Example: workspace:ws123:customers:list:v1:p1:l20
    """
    key = f"workspace:{workspace_id}:{resource}:list:v{version}"
    if page is not None:
        key += f":p{page}"
    if limit is not None:
        key += f":l{limit}"
    if filters:
        filter_str = json.dumps(filters, sort_keys=True, cls=CustomJSONEncoder)
        h = hashlib.md5(filter_str.encode()).hexdigest()[:8]
        key += f":q{h}"
    return key


def get_version_key(workspace_id: str, resource: str) -> str:
    """Returns standard cache version key for a resource within a workspace."""
    return f"workspace:{workspace_id}:{resource}:version"


# ==========================================
# ASYNC CACHE METHODS (Primary for FastAPI)
# ==========================================

async def async_get(key: str) -> Optional[str]:
    """Retrieves raw string value by key asynchronously."""
    if async_redis_client:
        try:
            val = await async_redis_client.get(key)
            if val is not None:
                logger.info(f"[METRIC] cache_hit key={key}")
                return val
            logger.info(f"[METRIC] cache_miss key={key}")
        except Exception as err:
            logger.warning(f"[METRIC] redis_error op=get key={key}: {err}")

    # Fallback to memory cache
    item = _memory_cache.get(key)
    if item:
        val, expires_at = item
        if time.time() < expires_at:
            logger.info(f"[METRIC] cache_hit (memory) key={key}")
            return val if isinstance(val, str) else serialize_value(val)
        else:
            del _memory_cache[key]
    logger.info(f"[METRIC] cache_miss (memory) key={key}")
    return None


async def async_set(key: str, value: str, ttl_seconds: int = CacheTTL.NORMAL_LIST) -> None:
    """Sets raw string value with TTL asynchronously."""
    if async_redis_client:
        try:
            await async_redis_client.setex(key, ttl_seconds, value)
            logger.info(f"[METRIC] cache_set key={key} ttl={ttl_seconds}")
            return
        except Exception as err:
            logger.warning(f"[METRIC] redis_error op=set key={key}: {err}")

    # Fallback to memory cache
    _memory_cache[key] = (value, time.time() + ttl_seconds)
    logger.info(f"[METRIC] cache_set (memory) key={key} ttl={ttl_seconds}")


async def async_get_json(key: str) -> Optional[Any]:
    """Retrieves JSON-parsed cache value asynchronously."""
    raw = await async_get(key)
    if raw is not None:
        try:
            return deserialize_value(raw)
        except Exception as err:
            logger.warning(f"[CACHE_WARN] JSON deserialize error for key {key}: {err}")
    return None


async def async_set_json(key: str, value: Any, ttl_seconds: int = CacheTTL.NORMAL_LIST) -> None:
    """Sets JSON-serializable cache value asynchronously."""
    try:
        json_str = serialize_value(value)
        await async_set(key, json_str, ttl_seconds=ttl_seconds)
    except Exception as e:
        logger.warning(f"[CACHE_WARN] JSON serialize error for key {key}: {e}")


async def async_delete(key: str) -> None:
    """Deletes key asynchronously."""
    if async_redis_client:
        try:
            await async_redis_client.delete(key)
            logger.info(f"[METRIC] cache_invalidation key={key}")
        except Exception as err:
            logger.warning(f"[METRIC] redis_error op=delete key={key}: {err}")
    if key in _memory_cache:
        del _memory_cache[key]


async def async_get_version(workspace_id: str, resource: str) -> int:
    """Gets resource version integer asynchronously (defaults to 1)."""
    v_key = get_version_key(workspace_id, resource)
    if async_redis_client:
        try:
            val = await async_redis_client.get(v_key)
            if val is not None:
                return int(val)
        except Exception as err:
            logger.warning(f"[METRIC] redis_error op=get_version key={v_key}: {err}")

    # Fallback to memory versions
    return _memory_versions.get(v_key, 1)


async def async_increment_version(workspace_id: str, resource: str) -> int:
    """Atomically increments resource version asynchronously and returns new version."""
    v_key = get_version_key(workspace_id, resource)
    new_v = 1
    if async_redis_client:
        try:
            new_v = await async_redis_client.incr(v_key)
            logger.info(f"[METRIC] cache_invalidation workspace={workspace_id} resource={resource} new_version={new_v}")
            return new_v
        except Exception as err:
            logger.warning(f"[METRIC] redis_error op=increment_version key={v_key}: {err}")

    # Memory version fallback
    current = _memory_versions.get(v_key, 1)
    new_v = current + 1
    _memory_versions[v_key] = new_v
    logger.info(f"[METRIC] cache_invalidation (memory) workspace={workspace_id} resource={resource} new_version={new_v}")
    return new_v


async def async_invalidate_list(workspace_id: str, resource: str) -> int:
    """Alias for async_increment_version."""
    return await async_increment_version(workspace_id, resource)


# ==========================================
# SYNC CACHE METHODS (For backward compatibility / sync callers)
# ==========================================

def get_cache(key: str) -> Optional[Any]:
    """Retrieves JSON-parsed cache value by key synchronously."""
    if sync_redis_client:
        try:
            val = sync_redis_client.get(key)
            if val is not None:
                logger.info(f"[METRIC] cache_hit key={key}")
                return deserialize_value(val)
        except Exception as err:
            logger.warning(f"[METRIC] redis_error op=get key={key}: {err}")

    item = _memory_cache.get(key)
    if item:
        val, expires_at = item
        if time.time() < expires_at:
            logger.info(f"[METRIC] cache_hit (memory) key={key}")
            return val if not isinstance(val, str) else deserialize_value(val)
        else:
            del _memory_cache[key]
    logger.info(f"[METRIC] cache_miss key={key}")
    return None


def set_cache(key: str, value: Any, ttl_seconds: int = CacheTTL.NORMAL_LIST) -> None:
    """Sets a JSON-serializable cache entry with TTL synchronously."""
    try:
        json_str = serialize_value(value)
        if sync_redis_client:
            try:
                sync_redis_client.setex(key, ttl_seconds, json_str)
                logger.info(f"[METRIC] cache_set key={key} ttl={ttl_seconds}")
                return
            except Exception as err:
                logger.warning(f"[METRIC] redis_error op=set key={key}: {err}")

        _memory_cache[key] = (value, time.time() + ttl_seconds)
    except Exception as e:
        logger.warning(f"[CACHE_WARN] Failed to serialize cache value for key {key}: {e}")


def invalidate_cache(key: str) -> None:
    """Invalidates cache key synchronously."""
    if sync_redis_client:
        try:
            sync_redis_client.delete(key)
            logger.info(f"[METRIC] cache_invalidation key={key}")
        except Exception as err:
            logger.warning(f"[METRIC] redis_error op=delete key={key}: {err}")
    if key in _memory_cache:
        del _memory_cache[key]


def get_version(workspace_id: str, resource: str) -> int:
    """Gets version integer synchronously."""
    v_key = get_version_key(workspace_id, resource)
    if sync_redis_client:
        try:
            val = sync_redis_client.get(v_key)
            if val is not None:
                return int(val)
        except Exception as err:
            logger.warning(f"[METRIC] redis_error op=get_version key={v_key}: {err}")
    return _memory_versions.get(v_key, 1)


def increment_version(workspace_id: str, resource: str) -> int:
    """Increments resource version integer synchronously."""
    v_key = get_version_key(workspace_id, resource)
    if sync_redis_client:
        try:
            new_v = sync_redis_client.incr(v_key)
            logger.info(f"[METRIC] cache_invalidation workspace={workspace_id} resource={resource} new_version={new_v}")
            return new_v
        except Exception as err:
            logger.warning(f"[METRIC] redis_error op=increment_version key={v_key}: {err}")

    current = _memory_versions.get(v_key, 1)
    new_v = current + 1
    _memory_versions[v_key] = new_v
    return new_v


def invalidate_list(workspace_id: str, resource: str) -> int:
    """Sync alias for increment_version."""
    return increment_version(workspace_id, resource)


def build_rag_cache_key(workspace_id: str, query: str, version: int = 1) -> str:
    """Generates tenant-scoped RAG query cache key: rag:query:{workspace_id}:{version}:{query_hash}"""
    q_hash = hashlib.sha256(query.strip().lower().encode("utf-8")).hexdigest()[:16]
    return f"rag:query:{workspace_id}:v{version}:{q_hash}"

async def async_invalidate_rag_cache(workspace_id: str) -> int:
    """Invalidates RAG query cache version for a workspace whenever knowledge changes."""
    return await async_increment_version(workspace_id, "knowledge_rag")
