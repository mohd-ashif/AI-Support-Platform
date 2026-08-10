"""initial_schema_and_pgvector

Revision ID: 0001_initial
Revises: 
Create Date: 2026-08-05

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
from pgvector.sqlalchemy import Vector

revision: str = '0001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector;")
    
    op.create_table(
        'users',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('email', sa.String(), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(), nullable=True),
        sa.Column('google_id', sa.String(), nullable=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )
    
    op.create_table(
        'businesses',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('website_url', sa.String(), nullable=True),
        sa.Column('industry', sa.String(), nullable=True),
        sa.Column('logo_url', sa.String(), nullable=True),
        sa.Column('owner_user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    op.create_table(
        'plans',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('price_monthly', sa.Numeric(10, 2), nullable=False, server_default='0.0'),
        sa.Column('price_annual', sa.Numeric(10, 2), nullable=False, server_default='0.0'),
        sa.Column('message_limit', sa.Integer(), nullable=False, server_default='1000'),
        sa.Column('seat_limit', sa.Integer(), nullable=False, server_default='3'),
        sa.Column('features_json', sa.JSON(), nullable=False, server_default='{}')
    )

    op.create_table(
        'workspaces',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('business_id', sa.String(), sa.ForeignKey('businesses.id'), nullable=False),
        sa.Column('workspace_uuid', sa.String(), nullable=False, unique=True),
        sa.Column('plan_id', sa.String(), sa.ForeignKey('plans.id'), nullable=True),
        sa.Column('status', sa.String(), nullable=False, server_default='active'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False)
    )

    op.create_table(
        'team_members',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('role', sa.String(), nullable=False, server_default='agent'),
        sa.Column('invited_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('joined_at', sa.DateTime(timezone=True), nullable=True)
    )

    op.create_table(
        'knowledge_chunks',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('workspace_id', sa.String(), sa.ForeignKey('workspaces.id'), nullable=False),
        sa.Column('source_type', sa.String(), nullable=False),
        sa.Column('source_id', sa.String(), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('embedding', Vector(1536), nullable=True),
        sa.Column('token_count', sa.Integer(), nullable=False, server_default='0')
    )

def downgrade() -> None:
    op.drop_table('knowledge_chunks')
    op.drop_table('team_members')
    op.drop_table('workspaces')
    op.drop_table('plans')
    op.drop_table('businesses')
    op.drop_table('users')
