import asyncio
from sqlalchemy import text
from apps.api.src.database.session import engine

async def migrate():
    print("Running explicit schema migration for workspaces table...")
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS integration_viewed BOOLEAN DEFAULT FALSE;"))
            print("   [✓] Column integration_viewed verified/added.")
        except Exception as e:
            print(f"   [!] Column integration_viewed error: {e}")

        try:
            await conn.execute(text("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS widget_tested BOOLEAN DEFAULT FALSE;"))
            print("   [✓] Column widget_tested verified/added.")
        except Exception as e:
            print(f"   [!] Column widget_tested error: {e}")
    print("Migration complete!")

if __name__ == "__main__":
    asyncio.run(migrate())
