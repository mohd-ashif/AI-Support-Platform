import logging
import asyncio
from datetime import timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_

from apps.api.src.database.session import get_db
from apps.api.src.models.core import (
    Workspace,
    Conversation,
    Message,
    Plan,
    Subscription,
    utc_now,
    generate_uuid,
)
from apps.api.src.services.rate_limiter import check_rate_limits
from apps.api.src.graph.agent_graph import (
    GraphState,
    retrieve_knowledge_chunks,
    evaluate_tool_router,
    run_reasoner_node,
)

logger = logging.getLogger("public_chat_router")

router = APIRouter(prefix="/public", tags=["public_chat"])

class ConversationCreateRequest(BaseModel):
    visitor_id: str

class ConversationResponse(BaseModel):
    conversation_id: str
    workspace_uuid: str
    status: str
    is_reused: bool

class MessageCreateRequest(BaseModel):
    visitor_id: str
    content: str

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    sender_type: str  # visitor, ai, agent
    content: str
    created_at: str
    should_escalate: bool = False

@router.post("/{workspace_uuid}/conversations", response_model=ConversationResponse)
async def create_or_reuse_conversation(
    workspace_uuid: str,
    payload: ConversationCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    # Step 6: Validate workspace_uuid / workspace_id and active status
    res_ws = await db.execute(
        select(Workspace).where(
            or_(
                Workspace.workspace_uuid == workspace_uuid,
                Workspace.id == workspace_uuid,
            )
        )
    )
    ws = res_ws.scalars().first()
    if not ws:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Public workspace not found.",
        )

    # Note: past_due is intentionally allowed per product requirements
    if ws.status == "canceled":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Workspace subscription is inactive.",
        )

    # Step 6 REUSE logic: Check if thread exists within past 24 hours & not resolved
    # Note: Preview visitors (preview_visitor_...) skip 24h reuse to guarantee fresh testing threads
    if not payload.visitor_id.startswith("preview_visitor_"):
        cutoff = utc_now() - timedelta(hours=24)
        res_conv = await db.execute(
            select(Conversation).where(
                Conversation.workspace_id == ws.id,
                Conversation.visitor_id == payload.visitor_id,
                Conversation.status != "resolved",
                Conversation.created_at >= cutoff,
            ).order_by(Conversation.created_at.desc())
        )
        existing_conv = res_conv.scalars().first()

        if existing_conv:
            return ConversationResponse(
                conversation_id=existing_conv.id,
                workspace_uuid=workspace_uuid,
                status=existing_conv.status,
                is_reused=True,
            )

    # Create fresh conversation
    new_conv = Conversation(
        workspace_id=ws.id,
        visitor_id=payload.visitor_id,
        status="bot",
    )
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv)

    return ConversationResponse(
        conversation_id=new_conv.id,
        workspace_uuid=workspace_uuid,
        status=new_conv.status,
        is_reused=False,
    )

@router.post("/{workspace_uuid}/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_public_message(
    workspace_uuid: str,
    conversation_id: str,
    payload: MessageCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    # Step 7: Abuse-prevention sliding-window rate limit
    await check_rate_limits(payload.visitor_id, workspace_uuid)

    res_ws = await db.execute(
        select(Workspace).where(
            or_(
                Workspace.workspace_uuid == workspace_uuid,
                Workspace.id == workspace_uuid,
            )
        )
    )
    ws = res_ws.scalars().first()
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found.")

    res_conv = await db.execute(
        select(Conversation).where(
            Conversation.id == conversation_id,
            Conversation.workspace_id == ws.id,
        )
    )
    conv = res_conv.scalars().first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation thread not found.")

    # 1. Record Visitor Message in DB
    user_msg = Message(
        conversation_id=conv.id,
        sender_type="visitor",
        content=payload.content,
    )
    db.add(user_msg)
    await db.commit()
    await db.refresh(user_msg)

    # Emit visitor message event immediately to Inbox & Widget
    try:
        from apps.api.src.socket_app import emit_to_workspace, emit_to_conversation
        user_created_str = (user_msg.created_at or utc_now()).isoformat()
        visitor_msg_payload = {
            "id": user_msg.id,
            "conversation_id": conv.id,
            "workspace_id": ws.id,
            "sender_type": "visitor",
            "content": user_msg.content,
            "created_at": user_created_str,
        }
        await emit_to_workspace(ws.id, "message:new", visitor_msg_payload)
        await emit_to_conversation(conv.id, "message:new", visitor_msg_payload)
    except Exception as err:
        logger.warning(f"Failed to emit visitor message socket event: {err}")

    try:
        user_created_str = (user_msg.created_at or utc_now()).isoformat()
        # STEP 4: If status="human", do NOT enqueue AI task (unless testing in preview mode)!
        if conv.status == "human" and not payload.visitor_id.startswith("preview_visitor_"):
            logger.info(f"[DEBUG-RAG] conv status is human — skipping AI task enqueue")
            return MessageResponse(
                id=user_msg.id,
                conversation_id=conv.id,
                sender_type="visitor",
                content=user_msg.content,
                created_at=user_created_str,
                should_escalate=True,
            )

        # Fetch Conversation History (last 6 messages)
        history_res = await db.execute(
            select(Message)
            .where(Message.conversation_id == conv.id)
            .order_by(Message.created_at.desc())
            .limit(6)
        )
        history_messages = list(reversed(history_res.scalars().all()))
        history_tuples = [
            {"role": "user" if m.sender_type == "visitor" else "assistant", "content": m.content}
            for m in history_messages[:-1]
        ]

        # Launch AI reasoning generation via Groq
        async def _generate_ai_response():
            import sys
            import importlib
            from apps.api.src.database.session import AsyncSessionLocal
            from apps.api.src.socket_app import emit_to_workspace, emit_to_conversation
            
            try:
                try:
                    import apps.api.src.graph.agent_graph as agent_graph_module
                    importlib.reload(agent_graph_module)
                except ModuleNotFoundError:
                    import src.graph.agent_graph as agent_graph_module
                    importlib.reload(agent_graph_module)

                retrieve_knowledge_chunks = agent_graph_module.retrieve_knowledge_chunks
                run_reasoner_node = agent_graph_module.run_reasoner_node
                GraphState = agent_graph_module.GraphState
                
                async with AsyncSessionLocal() as bg_db:
                    res_c = await bg_db.execute(select(Conversation).where(Conversation.id == conv.id))
                    c_obj = res_c.scalars().first()
                    if not c_obj:
                        return
                    
                    # For preview visitors, ensure conversation status allows AI processing
                    if payload.visitor_id.startswith("preview_visitor_") and c_obj.status == "human":
                        c_obj.status = "bot"
                        await bg_db.commit()
                    # Check Monthly AI Message Quota
                    if not payload.visitor_id.startswith("preview_visitor_"):
                        sub_res = await bg_db.execute(select(Subscription).where(Subscription.workspace_id == ws.id))
                        sub = sub_res.scalars().first()
                        plan_id = (sub.plan_id if sub else None) or ws.plan_id
                        plan = None
                        if plan_id:
                            p_res = await bg_db.execute(select(Plan).where((Plan.id == plan_id) | (Plan.name == plan_id)))
                            plan = p_res.scalars().first()

                        msg_limit = plan.message_limit if (plan and plan.message_limit is not None) else 100
                        if msg_limit != -1:
                            now = utc_now()
                            period_start = (sub.current_period_end - timedelta(days=30)) if (sub and sub.current_period_end) else now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
                            msg_cnt_res = await bg_db.execute(
                                select(func.count(Message.id))
                                .join(Conversation, Message.conversation_id == Conversation.id)
                                .where(
                                    Conversation.workspace_id == ws.id,
                                    Message.sender_type == "ai",
                                    Message.created_at >= period_start,
                                )
                            )
                            used_cnt = msg_cnt_res.scalar() or 0
                            if used_cnt >= msg_limit:
                                c_obj.status = "human"
                                await bg_db.commit()
                                quota_text = "Monthly AI message limit reached for this workspace. A human agent will assist you shortly."
                                quota_msg = Message(
                                    conversation_id=conv.id,
                                    sender_type="ai",
                                    content=quota_text,
                                )
                                bg_db.add(quota_msg)
                                await bg_db.commit()
                                await bg_db.refresh(quota_msg)
                                msg_payload = {
                                    "id": quota_msg.id,
                                    "conversation_id": conv.id,
                                    "workspace_id": ws.id,
                                    "sender_type": "ai",
                                    "content": quota_text,
                                    "created_at": quota_msg.created_at.isoformat(),
                                    "should_escalate": True,
                                }
                                await emit_to_conversation(conv.id, "message:new", msg_payload)
                                await emit_to_workspace(ws.id, "message:new", msg_payload)
                                await emit_to_conversation(conv.id, "conversation:status_changed", {"status": "human"})
                                return

                    from apps.api.src.services.citation_service import extract_verifiable_citations
                    citations = extract_verifiable_citations(chunks)

                    chunks, max_confidence = await retrieve_knowledge_chunks(
                        workspace_id=ws.id,
                        query=payload.content,
                        db=bg_db,
                    )
                    state: GraphState = {
                        "workspace_id": ws.id,
                        "conversation_id": conv.id,
                        "visitor_message": payload.content,
                        "conversation_history": history_tuples,
                        "retrieved_chunks": chunks,
                        "retrieval_confidence": max_confidence,
                        "turn_count_unresolved": 0 if max_confidence >= 0.5 else 1,
                        "should_escalate": False,
                        "response_text": "",
                    }
                    ai_text, should_esc = await run_reasoner_node(state, db=bg_db)
                    
                    # Low confidence threshold triggers human handoff
                    if max_confidence < 0.4:
                        should_esc = True

                    # Do not escalate preview testing sessions
                    if payload.visitor_id.startswith("preview_visitor_"):
                        should_esc = False
                    elif should_esc:
                        c_obj.status = "human"
                        await bg_db.commit()

                    ai_msg = Message(
                        conversation_id=conv.id,
                        sender_type="ai",
                        content=ai_text,
                    )
                    bg_db.add(ai_msg)
                    await bg_db.commit()
                    await bg_db.refresh(ai_msg)

                    msg_payload = {
                        "id": ai_msg.id,
                        "conversation_id": conv.id,
                        "workspace_id": ws.id,
                        "sender_type": "ai",
                        "content": ai_text,
                        "created_at": ai_msg.created_at.isoformat(),
                        "should_escalate": should_esc,
                        "citations": citations,
                        "confidence_score": max_confidence,
                    }
                    await emit_to_conversation(conv.id, "message:new", msg_payload)
                    await emit_to_workspace(ws.id, "message:new", msg_payload)
                    if should_esc:
                        await emit_to_conversation(conv.id, "conversation:status_changed", {"status": "human"})
            except Exception as bg_err:
                import traceback
                tb_str = traceback.format_exc()
                err_detail = f"[{type(bg_err).__name__}]: {bg_err}"
                logger.error(f"[EXPLICIT-DIAGNOSTIC-BG] Exception captured: {err_detail}\nTraceback:\n{tb_str}", exc_info=True)
                print(f"[EXPLICIT-DIAGNOSTIC-BG] Exception captured: {err_detail}\nTraceback:\n{tb_str}", flush=True)

        asyncio.create_task(_generate_ai_response())

        return MessageResponse(
            id=user_msg.id,
            conversation_id=conv.id,
            sender_type="visitor",
            content=user_msg.content,
            created_at=user_created_str,
            should_escalate=False,
        )
    except Exception as e:
        import traceback
        tb_str = traceback.format_exc()
        err_detail = f"[{type(e).__name__}]: {e}"
        logger.error(f"[EXPLICIT-DIAGNOSTIC] Catch point exception: {err_detail}\nTraceback:\n{tb_str}", exc_info=True)
        print(f"[EXPLICIT-DIAGNOSTIC] Catch point exception: {err_detail}\nTraceback:\n{tb_str}", flush=True)

        fallback_msg = Message(
            conversation_id=conv.id,
            sender_type="ai",
            content="I apologize, but I ran into a technical issue. Let me connect you with our human support team right away.",
        )
        conv.status = "human"
        db.add(fallback_msg)
        await db.commit()
        await db.refresh(fallback_msg)

        return MessageResponse(
            id=fallback_msg.id,
            conversation_id=conv.id,
            sender_type="ai",
            content=fallback_msg.content,
            created_at=(fallback_msg.created_at or utc_now()).isoformat(),
            should_escalate=True,
        )

@router.get("/{workspace_uuid}/conversations/{conversation_id}/messages", response_model=List[MessageResponse])
async def get_public_messages(
    workspace_uuid: str,
    conversation_id: str,
    db: AsyncSession = Depends(get_db),
):
    res_msg = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at.asc())
    )
    messages = res_msg.scalars().all()
    return [
        MessageResponse(
            id=m.id,
            conversation_id=m.conversation_id,
            sender_type=m.sender_type,
            content=m.content,
            created_at=(m.created_at or utc_now()).isoformat(),
        )
        for m in messages
    ]
