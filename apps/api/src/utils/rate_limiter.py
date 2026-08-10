import time
from collections import defaultdict
from typing import Dict, List, Tuple
from fastapi import HTTPException, Request, Response, status

class SlidingWindowRateLimiter:
    """Sliding window rate limiter with Redis-like in-memory tracking and Retry-After header."""
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.history: Dict[str, List[float]] = defaultdict(list)

    def check(self, key: str) -> Tuple[bool, int]:
        now = time.time()
        window_start = now - self.window_seconds
        
        # Filter timestamps within window
        self.history[key] = [t for t in self.history[key] if t > window_start]
        
        if len(self.history[key]) >= self.max_requests:
            oldest = self.history[key][0]
            retry_after = int(oldest + self.window_seconds - now) + 1
            return False, max(1, retry_after)
        
        self.history[key].append(now)
        return True, 0

    def reset(self, key: str = None):
        if key:
            self.history.pop(key, None)
        else:
            self.history.clear()

# 5 requests per IP per 3600 seconds (1 hour)
register_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=3600)

# 5 requests per email per 900 seconds (15 minutes)
login_limiter = SlidingWindowRateLimiter(max_requests=5, window_seconds=900)

def rate_limit_register(request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    allowed, retry_after = register_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Registration limit reached. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

def rate_limit_login(request: Request):
    client_ip = request.client.host if request.client else "127.0.0.1"
    allowed, retry_after = login_limiter.check(client_ip)
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Too many login attempts. Please try again in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )
