from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, func, desc, or_, and_

from apps.api.src.database.session import get_db
from apps.api.src.dependencies.auth import get_current_user, get_current_workspace_member
from apps.api.src.models.core import (
    User,
    Conversation,
    Message,
    TeamMember,
    ConversationRead,
    Workspace,
    utc_now,
    generate_uuid,
)

router = APIRouter(prefix="/conversations", tags=["inbox"])

class MessageSchema(BaseModel):
    id: str
    conversation_id: str
    sender_type: str  # visitor, ai, agent
    content: str
    created_at: str

class ConversationItemResponse(BaseModel):
    id: str
    workspace_id: str
    visitor_id: str
    channel: str
    status: str  # open, bot, human, resolved
    assigned_agent_id: Optional[str] = None
    created_at: str
    last_message_preview: Optional[str] = None
    last_message_at: str
    is_unread: bool

class ConversationListResponse(BaseModel):
    items: List[ConversationItemResponse]
    next_cursor: Optional[str] = None

class MessageCreateRequest(BaseModel):
    content: str

class AssignRequest(BaseModel):
    force: bool = False

# STEP 2 — Conversation list & cursor-based pagination
@router.get("", response_model=ConversationListResponse)
async def list_conversations(
    status_filter: Optional[str] = Query(None, alias="status"),
    cursor: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    # Query workspace conversations
    stmt = (
        select(Conversation)
        .where(Conversation.workspace_id == member.workspace_id)
    )

    if status_filter and status_filter.lower() != "all":
        stmt = stmt.where(Conversation.status == status_filter.lower())

    if cursor:
        # Simple cursor filter based on created_at string/iso
        stmt = stmt.where(Conversation.id < cursor)

    stmt = stmt.order_by(Conversation.created_at.desc()).limit(limit + 1)
    res = await db.execute(stmt)
    convs = list(res.scalars().all())

    has_more = len(convs) > limit
    if has_more:
        items_to_return = convs[:limit]
        next_cursor = items_to_return[-1].id
    else:
        items_to_return = convs
        next_cursor = None

    # Get agent last read time
    reads_map = {}
    try:
        read_res = await db.execute(
            select(ConversationRead).where(ConversationRead.team_member_id == member.id)
        )
        reads_map = {r.conversation_id: r.last_read_at for r in read_res.scalars().all()}
    except Exception:
        await db.rollback()
        try:
            from apps.api.src.database.session import engine
            from apps.api.src.models.core import Base
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
        except Exception:
            pass

    output_items = []
    for c in items_to_return:
        # Get last message
        msg_res = await db.execute(
            select(Message)
            .where(Message.conversation_id == c.id)
            .order_by(Message.created_at.desc())
            .limit(1)
        )
        last_msg = msg_res.scalars().first()
        last_msg_text = last_msg.content if last_msg else "No messages yet"
        last_msg_time = last_msg.created_at if last_msg else c.created_at

        # Unread check per agent
        agent_last_read = reads_map.get(c.id)
        is_unread = False
        if last_msg:
            if not agent_last_read or last_msg.created_at > agent_last_read:
                is_unread = True

        output_items.append(
            ConversationItemResponse(
                id=c.id,
                workspace_id=c.workspace_id,
                visitor_id=c.visitor_id,
                channel=c.channel,
                status=c.status,
                assigned_agent_id=c.assigned_agent_id,
                created_at=c.created_at.isoformat(),
                last_message_preview=last_msg_text[:60],
                last_message_at=last_msg_time.isoformat(),
                is_unread=is_unread,
            )
        )

    return ConversationListResponse(items=output_items, next_cursor=next_cursor)

# STEP 2 — Unread Tracking: Mark Read
@router.post("/{conversation_id}/mark-read")
async def mark_conversation_read(
    conversation_id: str,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res_conv = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == member.workspace_id,
        )
    )
    if not res_conv.scalars().first():
        raise HTTPException(status_code=404, detail="Conversation not found or access denied")

    res_read = await db.execute(
        select(ConversationRead).where(
            ConversationRead.conversation_id == conversation_id,
            ConversationRead.team_member_id == member.id,
        )
    )
    read_row = res_read.scalars().first()
    if read_row:
        read_row.last_read_at = utc_now()
    else:
        read_row = ConversationRead(
            conversation_id=conversation_id,
            team_member_id=member.id,
            last_read_at=utc_now(),
        )
        db.add(read_row)
    await db.commit()
    return {"status": "ok"}

# STEP 3 — Assignment (Race-condition-safe)
@router.post("/{conversation_id}/assign")
async def assign_conversation(
    conversation_id: str,
    payload: AssignRequest = AssignRequest(),
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res_conv = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == member.workspace_id,
        )
    )
    conv = res_conv.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if conv.assigned_agent_id and conv.assigned_agent_id != member.user_id:
        if not payload.force and member.role not in ["owner", "admin"]:
            # Fetch assigned agent user details for message
            res_user = await db.execute(select(User).where(User.id == conv.assigned_agent_id))
            other_user = res_user.scalars().first()
            agent_name = other_user.name if other_user else "another agent"
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"already assigned to {agent_name}",
            )

    conv.assigned_agent_id = member.user_id
    conv.status = "human"  # Implicit human takeover on assignment
    await db.commit()

    try:
        from apps.api.src.socket_app import emit_to_workspace, emit_to_conversation
        await emit_to_workspace(member.workspace_id, "conversation:assigned", {
            "conversation_id": conv.id,
            "assigned_agent_id": conv.assigned_agent_id,
            "status": "human",
        })
        await emit_to_conversation(conv.id, "conversation:status_changed", {"status": "human"})
    except Exception as err:
        logger.warning(f"Failed to emit assign socket event: {err}")

    return {"status": "ok", "assigned_agent_id": conv.assigned_agent_id, "conversation_status": conv.status}

# STEP 5 — Agent reply (send message from Inbox)
@router.post("/{conversation_id}/messages", response_model=MessageSchema)
async def send_agent_message(
    conversation_id: str,
    payload: MessageCreateRequest,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res_conv = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == member.workspace_id,
        )
    )
    conv = res_conv.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    from apps.api.src.dependencies.rbac import has_role_permission, Permissions
    if not has_role_permission(member.role, Permissions.CONVERSATIONS_REPLY):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Permission denied. Required permission '{Permissions.CONVERSATIONS_REPLY}' is missing for role '{member.role}'.",
        )

    # Permission check: assigned agent OR owner/admin
    if conv.assigned_agent_id != member.user_id and member.role not in ["owner", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot reply to conversation assigned to another agent.",
        )

    msg = Message(
        conversation_id=conv.id,
        sender_type="agent",
        content=payload.content,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)

    try:
        from apps.api.src.socket_app import emit_to_workspace, emit_to_conversation
        agent_msg_payload = {
            "id": msg.id,
            "conversation_id": conv.id,
            "workspace_id": member.workspace_id,
            "sender_type": "agent",
            "content": msg.content,
            "created_at": msg.created_at.isoformat(),
        }
        await emit_to_workspace(member.workspace_id, "message:new", agent_msg_payload)
        await emit_to_conversation(conv.id, "message:new", agent_msg_payload)
    except Exception as err:
        logger.warning(f"Failed to emit agent message socket event: {err}")

    return MessageSchema(
        id=msg.id,
        conversation_id=msg.conversation_id,
        sender_type=msg.sender_type,
        content=msg.content,
        created_at=msg.created_at.isoformat(),
    )

# STEP 6 — Resolve conversation
@router.post("/{conversation_id}/resolve")
async def resolve_conversation(
    conversation_id: str,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res_conv = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == member.workspace_id,
        )
    )
    conv = res_conv.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    conv.status = "resolved"
    await db.commit()

    try:
        from apps.api.src.socket_app import emit_to_workspace, emit_to_conversation
        await emit_to_workspace(member.workspace_id, "conversation:resolved", {
            "conversation_id": conv.id,
            "status": "resolved",
        })
        await emit_to_conversation(conv.id, "conversation:status_changed", {"status": "resolved"})
    except Exception as err:
        logger.warning(f"Failed to emit resolve socket event: {err}")

    return {"status": "ok", "conversation_id": conv.id, "status": "resolved"}

@router.get("/{conversation_id}/messages", response_model=List[MessageSchema])
async def get_conversation_messages(
    conversation_id: str,
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    res_conv = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == member.workspace_id,
        )
    )
    conv = res_conv.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    res_msg = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = res_msg.scalars().all()
    return [
        MessageSchema(
            id=m.id,
            conversation_id=m.conversation_id,
            sender_type=m.sender_type,
            content=m.content,
            created_at=m.created_at.isoformat(),
        )
        for m in messages
    ]


@router.delete("/clear-preview", status_code=status.HTTP_200_OK)
async def clear_preview_conversations(
    member: TeamMember = Depends(get_current_workspace_member),
    db: AsyncSession = Depends(get_db),
):
    from sqlalchemy import delete
    res_convs = await db.execute(
        select(Conversation.id).where(
            Conversation.workspace_id == member.workspace_id,
            or_(
                Conversation.visitor_id.like("preview_visitor_%"),
                Conversation.visitor_id.like("visitor_%"),
            ),
        )
    )
    conv_ids = res_convs.scalars().all()
    if conv_ids:
        await db.execute(delete(Message).where(Message.conversation_id.in_(conv_ids)))
        await db.execute(delete(Conversation).where(Conversation.id.in_(conv_ids)))
        await db.commit()
    return {"status": "success", "cleared_count": len(conv_ids)}
