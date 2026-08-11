from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from apps.api.src.config.settings import settings

def get_async_db_url(url: str) -> str:
    if url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    elif url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)

    if "-pooler." in url:
        url = url.replace("-pooler.", ".", 1)

    if "asyncpg" in url:
        parsed = urlparse(url)
        if parsed.query:
            query_params = parse_qs(parsed.query)
            new_params = {}
            for k, v in query_params.items():
                if k == "sslmode":
                    new_params["ssl"] = v
                elif k in ("channel_binding",):
                    continue
                else:
                    new_params[k] = v
            new_query = urlencode(new_params, doseq=True)
            parsed = parsed._replace(query=new_query)
            url = urlunparse(parsed)
    return url

db_url = get_async_db_url(settings.DATABASE_URL)

engine_kwargs = {"echo": False}
if "sqlite" not in db_url:
    engine_kwargs.update({
        "pool_pre_ping": True,
        "pool_recycle": 300,
        "pool_size": 5,
        "max_overflow": 10,
        "connect_args": {
            "command_timeout": 30,
            "statement_cache_size": 0,
        }
    })

engine = create_async_engine(db_url, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

class Base(DeclarativeBase):
    pass

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

