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
    print(f"   Found {len(Base.metadata.tables)} registered models: {list(Base.metadata.tables.keys())}")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("   [✓] Tables created successfully.")
        async with engine.begin() as conn:
            try:
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_sources_web_workspace_id ON sources_web (workspace_id);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_sources_files_workspace_id ON sources_files (workspace_id);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_conversations_ws_created ON conversations (workspace_id, created_at DESC);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages (conversation_id, created_at DESC);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_widget_configs_workspace_id ON widget_configs (workspace_id);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys (workspace_id);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_id ON webhooks (workspace_id);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON subscriptions (workspace_id);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_team_members_workspace_id ON team_members (workspace_id);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_knowledge_sources_workspace_id ON knowledge_sources (workspace_id);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_knowledge_documents_workspace_id ON knowledge_documents (workspace_id);"))
                await conn.execute(text("CREATE INDEX IF NOT EXISTS idx_document_versions_workspace_id ON document_versions (workspace_id);"))
                print("   [✓] HNSW vector index & B-Tree performance indexes created/verified.")
            except Exception as e:
                print(f"   [!] Index note: {e}")
        
        async with engine.begin() as conn:
            try:
                await conn.execute(text("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS integration_viewed BOOLEAN DEFAULT FALSE;"))
                await conn.execute(text("ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS widget_tested BOOLEAN DEFAULT FALSE;"))
                await conn.execute(text("ALTER TABLE sources_web ADD COLUMN IF NOT EXISTS error_message VARCHAR;"))
                await conn.execute(text("ALTER TABLE sources_files ADD COLUMN IF NOT EXISTS error_message VARCHAR;"))
                await conn.execute(text("ALTER TABLE sources_files ADD COLUMN IF NOT EXISTS cloudinary_url VARCHAR DEFAULT '';"))
                await conn.execute(text("ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS document_id VARCHAR;"))
                await conn.execute(text("ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS version_id VARCHAR;"))
                await conn.execute(text("ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS chunk_index INTEGER DEFAULT 0;"))
                await conn.execute(text("ALTER TABLE knowledge_chunks ADD COLUMN IF NOT EXISTS metadata_json JSON DEFAULT '{}';"))
            except Exception:
                pass
    except Exception as e:
        print(f"   [X] Error during table creation: {e}")

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
