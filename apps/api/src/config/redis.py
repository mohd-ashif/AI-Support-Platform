import redis.asyncio as aioredis
from apps.api.src.config.settings import settings

redis_client = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
