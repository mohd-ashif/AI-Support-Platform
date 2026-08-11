"""performance_indexes

Revision ID: 0002_performance_indexes
Revises: 0001_initial
Create Date: 2026-08-10

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0002_performance_indexes'
down_revision: Union[str, None] = '0001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. HNSW Vector Index on knowledge_chunks.embedding for sub-millisecond similarity search
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding_hnsw 
        ON knowledge_chunks USING hnsw (embedding vector_cosine_ops);
    """)

    # 2. Multi-tenancy foreign key B-Tree indexes
    op.execute("CREATE INDEX IF NOT EXISTS idx_sources_web_workspace_id ON sources_web (workspace_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sources_files_workspace_id ON sources_files (workspace_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_conversations_ws_created ON conversations (workspace_id, created_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages (conversation_id, created_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_widget_configs_workspace_id ON widget_configs (workspace_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id ON api_keys (workspace_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_webhooks_workspace_id ON webhooks (workspace_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace_id ON subscriptions (workspace_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_team_members_workspace_id ON team_members (workspace_id);")

def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_knowledge_chunks_embedding_hnsw;")
    op.execute("DROP INDEX IF EXISTS idx_sources_web_workspace_id;")
    op.execute("DROP INDEX IF EXISTS idx_sources_files_workspace_id;")
    op.execute("DROP INDEX IF EXISTS idx_conversations_ws_created;")
    op.execute("DROP INDEX IF EXISTS idx_messages_conv_created;")
    op.execute("DROP INDEX IF EXISTS idx_widget_configs_workspace_id;")
    op.execute("DROP INDEX IF EXISTS idx_api_keys_workspace_id;")
    op.execute("DROP INDEX IF EXISTS idx_webhooks_workspace_id;")
    op.execute("DROP INDEX IF EXISTS idx_subscriptions_workspace_id;")
    op.execute("DROP INDEX IF EXISTS idx_team_members_workspace_id;")
