import logging
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from apps.api.src.models.core import AuditLog

logger = logging.getLogger("audit")


async def log_audit_event(
    db: AsyncSession,
    workspace_id: str,
    actor_user_id: str,
    action: str,
    resource: str,
    resource_id: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> AuditLog:
    """
    Persists an immutable audit log record for security compliance tracking.
    """
    try:
        audit_record = AuditLog(
            workspace_id=workspace_id,
            actor_user_id=actor_user_id,
            action=action,
            resource=resource,
            resource_id=resource_id,
            metadata_json=metadata or {},
        )
        db.add(audit_record)
        await db.flush()
        logger.info(f"[AUDIT] Action: {action} | Workspace: {workspace_id} | Actor: {actor_user_id}")
        return audit_record
    except Exception as err:
        logger.error(f"[AUDIT ERROR] Failed to record audit log: {err}")
        raise err
