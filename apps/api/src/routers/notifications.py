from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete, desc

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import get_current_workspace_member
from apps.api.src.models.core import TeamMember, Notification, generate_uuid, utc_now

router = APIRouter(prefix="/notifications", tags=["notifications"])

class NotificationResponse(BaseModel):
    id: str
    workspace_id: str
    title: str
    message: str
    type: str
    read: bool
    action_url: Optional[str] = None
    created_at: str

@router.get("", response_model=List[NotificationResponse])
async def list_notifications(
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Notification)
        .where(Notification.workspace_id == member.workspace_id)
        .order_by(desc(Notification.created_at))
        .limit(50)
    )
    notifications = res.scalars().all()
    return [
        NotificationResponse(
            id=n.id,
            workspace_id=n.workspace_id,
            title=n.title,
            message=n.message,
            type=n.type,
            read=n.read,
            action_url=n.action_url,
            created_at=n.created_at.isoformat() if n.created_at else "",
        )
        for n in notifications
    ]

@router.post("/{notification_id}/read")
async def mark_notification_read(
    notification_id: str,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.workspace_id == member.workspace_id,
        )
    )
    notif = res.scalars().first()
    if not notif:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")
    
    notif.read = True
    await db.commit()
    return {"message": "Notification marked as read", "id": notification_id}

@router.post("/read-all")
async def mark_all_notifications_read(
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        update(Notification)
        .where(Notification.workspace_id == member.workspace_id, Notification.read == False)
        .values(read=True)
    )
    await db.commit()
    return {"message": "All notifications marked as read"}

@router.delete("")
async def clear_notifications(
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(Notification).where(Notification.workspace_id == member.workspace_id)
    )
    await db.commit()
    return {"message": "All notifications cleared"}
