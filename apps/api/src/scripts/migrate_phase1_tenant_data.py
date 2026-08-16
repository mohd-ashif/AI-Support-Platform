import asyncio
import logging
import re
from typing import Dict
from sqlalchemy import select, func, update
from apps.api.src.database.session import AsyncSessionLocal
from apps.api.src.models.core import (
    User,
    Business,
    Workspace,
    TeamMember,
    Conversation,
    Message,
    SourceWeb,
    SourceFile,
    KnowledgeChunk,
    WidgetConfig,
    Subscription,
    utc_now,
    generate_uuid,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("phase1_data_migration")

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_-]+", "-", text)
    return text or "organization"

async def get_entity_counts(db) -> Dict[str, int]:
    counts = {}
    models = {
        "users": User,
        "businesses": Business,
        "workspaces": Workspace,
        "team_members": TeamMember,
        "conversations": Conversation,
        "messages": Message,
        "sources_web": SourceWeb,
        "sources_files": SourceFile,
        "knowledge_chunks": KnowledgeChunk,
        "widget_configs": WidgetConfig,
        "subscriptions": Subscription,
    }
    for name, model in models.items():
        res = await db.execute(select(func.count()).select_from(model))
        counts[name] = res.scalar() or 0
    return counts

async def run_data_migration():
    logger.info("=== PHASE 1: STARTING MULTI-TENANT DATA MIGRATION & VERIFICATION ===")
    async with AsyncSessionLocal() as db:
        # Step 0: Ensure missing columns exist in existing PostgreSQL/SQLite tables
        from sqlalchemy import text
        columns_to_add = [
            ("businesses", "slug", "VARCHAR"),
            ("businesses", "status", "VARCHAR DEFAULT 'active'"),
            ("businesses", "updated_at", "TIMESTAMP WITH TIME ZONE"),
            ("messages", "workspace_id", "VARCHAR"),
        ]
        for table, col, col_type in columns_to_add:
            try:
                await db.execute(text(f"ALTER TABLE {table} ADD COLUMN IF NOT EXISTS {col} {col_type};"))
            except Exception:
                try:
                    await db.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {col_type};"))
                except Exception as e:
                    logger.debug(f"Column {col} on {table} note: {e}")
        await db.commit()

        # Step 1: Count records before migration
        counts_before = await get_entity_counts(db)
        logger.info(f"Pre-migration Record Counts: {counts_before}")

        # Step 2: Ensure all Business records have valid slugs and status
        res_businesses = await db.execute(select(Business))
        businesses = res_businesses.scalars().all()
        
        slug_updates = 0
        for b in businesses:
            if not b.slug:
                base_slug = slugify(b.name)
                b.slug = f"{base_slug}-{b.id[:6]}"
                slug_updates += 1
            if not getattr(b, "status", None):
                b.status = "active"
            if not getattr(b, "updated_at", None):
                b.updated_at = b.created_at or utc_now()
        
        await db.commit()
        logger.info(f"Updated slugs for {slug_updates} business records.")

        # Step 3: Populate messages.workspace_id from parent conversation
        res_unlinked_msgs = await db.execute(
            select(Message).where(Message.workspace_id.is_(None))
        )
        unlinked_msgs = res_unlinked_msgs.scalars().all()
        
        msg_updates = 0
        if unlinked_msgs:
            # Batch map conversation_id -> workspace_id
            res_convs = await db.execute(select(Conversation.id, Conversation.workspace_id))
            conv_ws_map = {row[0]: row[1] for row in res_convs.all()}

            for msg in unlinked_msgs:
                ws_id = conv_ws_map.get(msg.conversation_id)
                if ws_id:
                    msg.workspace_id = ws_id
                    msg_updates += 1
            
            await db.commit()
        logger.info(f"Backfilled workspace_id for {msg_updates} message records.")

        # Step 4: Count records after migration & verify zero data loss
        counts_after = await get_entity_counts(db)
        logger.info(f"Post-migration Record Counts: {counts_after}")

        mismatches = []
        for entity, count_pre in counts_before.items():
            count_post = counts_after[entity]
            if count_pre != count_post:
                mismatches.append(f"{entity}: pre={count_pre}, post={count_post}")

        if mismatches:
            logger.error(f"DATA INTEGRITY FAILURE! Record count mismatch: {mismatches}")
            raise RuntimeError(f"Data migration count mismatch: {mismatches}")
        else:
            logger.info("✅ SUCCESS: 100% Data Preservation Verified across all entities!")

if __name__ == "__main__":
    asyncio.run(run_data_migration())
