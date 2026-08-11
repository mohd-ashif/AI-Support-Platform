import json
import logging
import time
from typing import Optional, Any
from apps.api.src.config.settings import settings

logger = logging.getLogger("cache_service")

# In-memory dictionary fallback cache when Redis is unavailable
_memory_cache = {}

try:
    import redis
    redis_url = getattr(settings, "REDIS_URL", "")
    if redis_url and not redis_url.startswith("mock"):
        redis_client = redis.Redis.from_url(redis_url, decode_responses=True)
    else:
        redis_client = None
except Exception as e:
    logger.warning(f"Redis client initialization note: {e}")
    redis_client = None

def get_cache(key: str) -> Optional[Any]:
    """Retrieves JSON-parsed cache value by key."""
    if redis_client:
        try:
            val = redis_client.get(key)
            if val:
                return json.loads(val)
        except Exception as err:
            logger.debug(f"Redis get error for key {key}: {err}")

    # Fallback to in-memory cache
    item = _memory_cache.get(key)
    if item:
        val, expires_at = item
        if time.time() < expires_at:
            return val
        else:
            del _memory_cache[key]
    return None

def set_cache(key: str, value: Any, ttl_seconds: int = 300) -> None:
    """Sets a JSON-serializable cache entry with TTL."""
    try:
        json_str = json.dumps(value)
        if redis_client:
            try:
                redis_client.setex(key, ttl_seconds, json_str)
                return
            except Exception as err:
                logger.debug(f"Redis set error for key {key}: {err}")
        
        # Memory fallback
        _memory_cache[key] = (value, time.time() + ttl_seconds)
    except Exception as e:
        logger.warning(f"Failed to serialize cache value for key {key}: {e}")

def invalidate_cache(key: str) -> None:
    """Invalidates cache key."""
    if redis_client:
        try:
            redis_client.delete(key)
        except Exception as err:
            logger.debug(f"Redis delete error for key {key}: {err}")
    if key in _memory_cache:
        del _memory_cache[key]
