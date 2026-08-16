import time
from typing import Callable
from fastapi import Request, HTTPException, status
from apps.api.src.config.redis import redis_client

# In-memory fallback dictionary if Redis is disconnected in dev
_fallback_rate_store = {}


def rate_limit(key_prefix: str, limit: int, window_seconds: int = 60) -> Callable:
    """
    FastAPI dependency factory enforcing rate limits via Redis or sliding window.
    """
    async def rate_limit_dependency(request: Request):
        client_ip = request.client.host if request.client else "unknown"
        current_time = int(time.time())
        window_bucket = current_time // window_seconds
        key = f"rate_limit:{key_prefix}:{client_ip}:{window_bucket}"

        count = 0
        if redis_client:
            try:
                pipe = redis_client.pipeline()
                pipe.incr(key)
                pipe.expire(key, window_seconds)
                res = pipe.execute()
                count = res[0]
            except Exception:
                # Fallback to local memory tracking if Redis experiences network transient
                count = _fallback_rate_store.get(key, 0) + 1
                _fallback_rate_store[key] = count
        else:
            count = _fallback_rate_store.get(key, 0) + 1
            _fallback_rate_store[key] = count

        if count > limit:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Rate limit exceeded for '{key_prefix}'. Limit is {limit} requests per {window_seconds} seconds.",
                headers={"Retry-After": str(window_seconds)},
            )

    return rate_limit_dependency
