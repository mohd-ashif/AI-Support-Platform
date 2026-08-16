"""phase1_multitenant_foundation

Revision ID: 0003_phase1_multitenant_foundation
Revises: 0002_performance_indexes
Create Date: 2026-08-16

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '0003_phase1_multitenant_foundation'
down_revision: Union[str, None] = '0002_performance_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    # 1. Add slug, status, updated_at columns to businesses table (if not exists)
    with op.batch_alter_table('businesses') as batch_op:
        batch_op.add_column(sa.Column('slug', sa.String(), nullable=True))
        batch_op.add_column(sa.Column('status', sa.String(), server_default='active', nullable=True))
        batch_op.add_column(sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))

    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_businesses_slug ON businesses (slug);")

    # 2. Add workspace_id column to messages table for direct $O(1)$ tenant querying
    with op.batch_alter_table('messages') as batch_op:
        batch_op.add_column(sa.Column('workspace_id', sa.String(), nullable=True))

    # 3. Create Multi-Tenant Compound Performance Indexes
    op.execute("CREATE INDEX IF NOT EXISTS idx_workspaces_business_id ON workspaces (business_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_team_members_ws_user ON team_members (workspace_id, user_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_team_members_ws_role ON team_members (workspace_id, role);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_conversations_ws_status ON conversations (workspace_id, status);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_conversations_ws_visitor ON conversations (workspace_id, visitor_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_messages_workspace_id ON messages (workspace_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_messages_ws_created ON messages (workspace_id, created_at DESC);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sources_web_ws_status ON sources_web (workspace_id, status);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_sources_files_ws_status ON sources_files (workspace_id, status);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_ws_source ON knowledge_chunks (workspace_id, source_id);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_analytics_daily_ws_date ON analytics_daily (workspace_id, date);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_api_keys_ws_prefix ON api_keys (workspace_id, key_prefix);")
    op.execute("CREATE INDEX IF NOT EXISTS idx_invites_ws_email ON invites (workspace_id, email);")

def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_invites_ws_email;")
    op.execute("DROP INDEX IF EXISTS idx_api_keys_ws_prefix;")
    op.execute("DROP INDEX IF EXISTS idx_analytics_daily_ws_date;")
    op.execute("DROP INDEX IF EXISTS idx_knowledge_chunks_ws_source;")
    op.execute("DROP INDEX IF EXISTS idx_sources_files_ws_status;")
    op.execute("DROP INDEX IF EXISTS idx_sources_web_ws_status;")
    op.execute("DROP INDEX IF EXISTS idx_messages_ws_created;")
    op.execute("DROP INDEX IF EXISTS idx_messages_workspace_id;")
    op.execute("DROP INDEX IF EXISTS idx_conversations_ws_visitor;")
    op.execute("DROP INDEX IF EXISTS idx_conversations_ws_status;")
    op.execute("DROP INDEX IF EXISTS idx_team_members_ws_role;")
    op.execute("DROP INDEX IF EXISTS idx_team_members_ws_user;")
    op.execute("DROP INDEX IF EXISTS idx_workspaces_business_id;")
    op.execute("DROP INDEX IF EXISTS idx_businesses_slug;")

    with op.batch_alter_table('messages') as batch_op:
        batch_op.drop_column('workspace_id')

    with op.batch_alter_table('businesses') as batch_op:
        batch_op.drop_column('updated_at')
        batch_op.drop_column('status')
        batch_op.drop_column('slug')
