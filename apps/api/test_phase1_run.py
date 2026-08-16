import asyncio
from apps.api.src.database.session import engine, Base
from apps.api.src.scripts.migrate_phase1_tenant_data import run_data_migration

async def main():
    print("Creating database schema tables if not exist...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Running Phase 1 data migration...")
    await run_data_migration()
    print("Phase 1 database migration and validation complete!")

if __name__ == "__main__":
    asyncio.run(main())
