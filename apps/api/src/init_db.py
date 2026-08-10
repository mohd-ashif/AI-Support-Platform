import asyncio
import sys
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent.parent.parent
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from sqlalchemy import text
from apps.api.src.database.session import engine, AsyncSessionLocal
import apps.api.src.models.core
from apps.api.src.models.core import Base
from apps.api.src.services.team_service import auto_seed_global_demo_accounts

async def init():
    print("--- NEON DATABASE INITIALIZER ---")
    print("1. Connecting to Neon PostgreSQL...")
    try:
        async with engine.begin() as conn:
            await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
            print("   [✓] Extension 'vector' initialized.")
    except Exception as e:
        print(f"   [!] Extension note: {e}")

    print("2. Creating all platform database tables & migrating schema...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        try:
            await conn.execute(text("ALTER TABLE workspaces ADD COLUMN integration_viewed BOOLEAN DEFAULT FALSE"))
        except Exception:
            pass
        try:
            await conn.execute(text("ALTER TABLE workspaces ADD COLUMN widget_tested BOOLEAN DEFAULT FALSE"))
        except Exception:
            pass
        print("   [✓] Tables and schema columns created/verified.")

    print("3. Verifying active tables in Neon Console schema...")
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"))
        tables = [r[0] for r in res.fetchall()]
        print(f"   [✓] Found {len(tables)} tables in 'public' schema:")
        for t in tables:
            print(f"       - {t}")

    print("4. Seeding default demo team accounts & subscription plans...")
    try:
        from apps.api.src.seed_plans import seed_plans
        await seed_plans()
        async with AsyncSessionLocal() as session:
            await auto_seed_global_demo_accounts(session)
        print("   [✓] Demo accounts and subscription plans ready.")
    except Exception as e:
        print(f"   [!] Seeding note: {e}")

    print("--- SETUP COMPLETE ---")

if __name__ == "__main__":
    asyncio.run(init())
