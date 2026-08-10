import time
import logging
from fastapi import HTTPException, status
from apps.api.src.config.redis import redis_client

logger = logging.getLogger("rate_limiter")

# Rate Limit Constants
VISITOR_LIMIT = 20        # Max 20 messages per visitor
VISITOR_WINDOW = 600      # 10 minutes (600 seconds)

WORKSPACE_LIMIT = 500     # Max 500 messages per workspace
WORKSPACE_WINDOW = 600    # 10 minutes (600 seconds)

async def check_rate_limits(visitor_id: str, workspace_uuid: str) -> None:
    now = time.time()
    
    # 1. Visitor Rate Limit Check
    visitor_key = f"rate_limit:visitor:{visitor_id}"
    try:
        # Use Redis sliding window list / sorted set or key counter
        visitor_count = await redis_client.incr(visitor_key)
        if visitor_count == 1:
            await redis_client.expire(visitor_key, VISITOR_WINDOW)
            
        if visitor_count > VISITOR_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded: Please slow down. (Max 20 messages per 10 minutes)",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Redis rate limiter warning (visitor check): {e}")

    # 2. Workspace Rate Limit Check
    workspace_key = f"rate_limit:workspace:{workspace_uuid}"
    try:
        ws_count = await redis_client.incr(workspace_key)
        if ws_count == 1:
            await redis_client.expire(workspace_key, WORKSPACE_WINDOW)
            
        if ws_count > WORKSPACE_LIMIT:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Workspace support rate limit exceeded: Please wait a moment before sending more messages.",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Redis rate limiter warning (workspace check): {e}")
