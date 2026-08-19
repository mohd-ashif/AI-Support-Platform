import sys
import os
import uuid
import logging
import time
from pathlib import Path

# Auto-resolve workspace root and apps/api directory in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
WORKSPACE_DIR = BASE_DIR.parent.parent

for p in [str(WORKSPACE_DIR), str(BASE_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

try:
    from starlette.middleware.sessions import SessionMiddleware
except ImportError:
    SessionMiddleware = None

try:
    from apps.api.src.config.settings import settings
    from apps.api.src.routers import (
        auth,
        sources,
        inbox,
        public_chat,
        widget,
        workspaces,
        team,
        analytics,
        billing,
        admin,
        uploads,
        onboarding,
        integrations,
        settings as settings_router,
        notifications,
        knowledge,
        jobs,
    )
except ModuleNotFoundError:
    from src.config.settings import settings
    from src.routers import (
        auth,
        sources,
        inbox,
        public_chat,
        widget,
        workspaces,
        team,
        analytics,
        billing,
        admin,
        uploads,
        onboarding,
        integrations,
        settings as settings_router,
        notifications,
        knowledge,
        jobs,
    )

logger = logging.getLogger("main")

app = FastAPI(
    title="SupportAI API",
    description="Enterprise AI Customer Support Platform API",
    version="1.0.0",
)

@app.middleware("http")
async def add_process_time_and_request_id_header(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    request.state.request_id = request_id
    start_time = time.perf_counter()
    
    response = await call_next(request)
    
    process_time_ms = (time.perf_counter() - start_time) * 1000
    response.headers["X-Process-Time"] = f"{process_time_ms:.2f}ms"
    response.headers["X-Request-ID"] = request_id
    logger.info(f"[PERF] [{request_id}] {request.method} {request.url.path} -> {response.status_code} ({process_time_ms:.2f}ms)")
    return response

app.add_middleware(GZipMiddleware, minimum_size=1000)

# CORS Middleware with production origin matching
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Session Middleware for OAuth
if SessionMiddleware is not None:
    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.SECRET_KEY,
    )

# Include Routers
app.include_router(auth.router)
app.include_router(sources.router)
app.include_router(inbox.router)
app.include_router(widget.router)
app.include_router(workspaces.router)
app.include_router(team.router)
app.include_router(analytics.router)
app.include_router(billing.router)
app.include_router(admin.router)
app.include_router(uploads.router)
app.include_router(onboarding.router)
app.include_router(integrations.router)
app.include_router(public_chat.router)
app.include_router(settings_router.router)
app.include_router(notifications.router)
app.include_router(knowledge.router)
app.include_router(jobs.router)

@app.on_event("startup")
async def on_startup():
    try:
        from sqlalchemy import text
        from apps.api.src.database.session import engine, Base
        from apps.api.src.scripts.migrate_phase1_tenant_data import run_data_migration
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
            for alter_sql in [
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR;",
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR;",
                "ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS replaced_by_id VARCHAR;",
                "ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS user_agent VARCHAR;",
                "ALTER TABLE refresh_tokens ADD COLUMN IF NOT EXISTS ip_address VARCHAR;",
                "ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS document_id VARCHAR;",
                "ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS version_id VARCHAR;",
                "ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0;",
                "ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS metadata_json JSON DEFAULT '{}';",
                "ALTER TABLE github_repositories ADD COLUMN IF NOT EXISTS error_message VARCHAR;",
            ]:
                try:
                    await conn.execute(text(alter_sql))
                except Exception:
                    pass
        await run_data_migration()
        logger.info("[STARTUP] Phase 1 database schema & tenant data migration completed successfully.")
    except Exception as e:
        logger.warning(f"[STARTUP] Phase 1 startup database init note: {e}")

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "SupportAI API"}

@app.get("/health/live")
async def health_live():
    return {"status": "healthy", "database": "healthy", "redis": "healthy"}

@app.get("/health/ready")
async def health_ready():
    db_status = "healthy"
    redis_status = "healthy"
    try:
        from sqlalchemy import text
        from apps.api.src.database.session import engine
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception as e:
        logger.error(f"[HEALTH-CHECK] Database ping failed: {e}")
        db_status = "unhealthy"

    try:
        from apps.api.src.config.redis import redis_client
        if redis_client:
            await redis_client.ping()
    except Exception as e:
        logger.warning(f"[HEALTH-CHECK] Redis ping note: {e}")
        # Soft degrade redis status if optional
        redis_status = "degraded"

    overall_status = "ready" if db_status == "healthy" else "unhealthy"
    return {
        "status": overall_status,
        "database": db_status,
        "redis": redis_status,
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", str(uuid.uuid4()))
    logger.error(f"[GLOBAL-EXCEPTION] [{request_id}] {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An internal server error occurred. Please contact support with the request ID.",
                "request_id": request_id,
            }
        },
    )

@app.get("/api/v1/docs", include_in_schema=False)
async def redirect_api_v1_docs():
    return RedirectResponse(url="/docs")

# Safely wrap FastAPI application with Socket.io ASGI app if socketio is installed
try:
    try:
        from apps.api.src.socket_app import sio, socketio
    except ModuleNotFoundError:
        from src.socket_app import sio, socketio
    if socketio is not None and sio is not None:
        app = socketio.ASGIApp(sio, other_asgi_app=app)
except Exception as e:
        logger.warning(f"Socket.io ASGI app wrapper skipped: {e}")

