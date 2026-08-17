import re
import asyncio
import logging
from typing import List, Dict, Any, Optional, TypedDict, Tuple

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from apps.api.src.models.core import KnowledgeChunk, Conversation, Message, Workspace, Plan, utc_now, generate_uuid
from apps.api.src.services.embedding_service import fetch_embeddings_batch
from apps.api.src.config.settings import settings

logger = logging.getLogger("agent_graph")

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_CHAT_MODEL = "llama-3.3-70b-versatile"

HANDOFF_PHRASES = [
    "talk to a human",
    "speak to someone",
    "speak to a human",
    "real person",
    "talk to an agent",
    "human agent",
    "support agent",
    "connect me with a person",
]

class GraphState(TypedDict):
    workspace_id: str
    conversation_id: str
    visitor_message: str
    conversation_history: List[Dict[str, str]]
    retrieved_chunks: List[Dict[str, Any]]
    retrieval_confidence: float
    turn_count_unresolved: int
    should_escalate: bool
    response_text: str

# SECURITY CRITICAL: Multi-tenant vector retrieval function.
# workspace_id MUST be a required positional argument (never optional/defaulted)
# to structurally prevent cross-tenant vector leakage.
async def retrieve_knowledge_chunks(
    workspace_id: str,
    query: str,
    db: AsyncSession,
    top_k: int = 5,
    similarity_threshold: float = 0.5,
) -> Tuple[List[Dict[str, Any]], float]:
    from apps.api.src.services.retrieval_service import get_retrieval_service
    retrieval_svc = get_retrieval_service()
    return await retrieval_svc.retrieve_relevant_knowledge(
        workspace_id=workspace_id,
        query=query,
        db=db,
        top_k=top_k,
        similarity_threshold=similarity_threshold,
    )

def evaluate_tool_router(
    state: GraphState,
    conversation_status: str,
    prev_zero_confidence: bool = False,
) -> bool:
    # Rule 1: Persistent escalation — once escalated ("human"), STAYS escalated
    if conversation_status == "human":
        return True

    msg_lower = state["visitor_message"].lower()

    # Rule 2: Explicit human handoff intent
    for phrase in HANDOFF_PHRASES:
        if phrase in msg_lower:
            return True

    # Rule 4: turn_count_unresolved >= 3
    if state["turn_count_unresolved"] >= 3:
        return True

    return False

async def run_reasoner_node(state: GraphState, db: Optional[AsyncSession] = None) -> Tuple[str, bool]:
    """
    Executes grounded LLM reasoner node.
    Returns Tuple[response_text: str, should_escalate: bool].
    """
    msg_clean = state["visitor_message"].strip().lower()
    workspace_id = state["workspace_id"]
    
    # 1. Resolve workspace brand_name
    brand_name = "our company"
    if db:
        try:
            from apps.api.src.models.core import WidgetConfig, Workspace
            res_cfg = await db.execute(select(WidgetConfig).where(WidgetConfig.workspace_id == workspace_id))
            cfg = res_cfg.scalars().first()
            if cfg and cfg.brand_name:
                brand_name = cfg.brand_name
            else:
                res_ws = await db.execute(select(Workspace).where(Workspace.id == workspace_id))
                ws = res_ws.scalars().first()
                if ws and ws.name:
                    brand_name = ws.name
        except Exception:
            pass

    # 2. Natural greeting handling
    greetings = {"hi", "hello", "hey", "greetings", "good morning", "good afternoon", "good evening", "hi there", "hello there", "help", "who are you"}
    if msg_clean in greetings or any(msg_clean.startswith(g) for g in ["hi ", "hello ", "hey "]):
        return f"Hello! How can I assist you today? Feel free to ask me anything about {brand_name}'s products, pricing, documentation, or services.", False

    chunks = state["retrieved_chunks"]
    confidence = state["retrieval_confidence"]

    # 3. Grounding check: Only refuse if zero chunks exist for this workspace
    if not chunks:
        refusal_msg = f"I don't have information about that in {brand_name}'s knowledge base. Would you like me to connect you with someone from the team who can help?"
        return refusal_msg, True

    # Build dynamic anti-injection system prompt using RAG Prompt Builder
    from apps.api.src.services.rag_prompt_service import build_rag_prompt
    rag_payload = build_rag_prompt(
        question=state["visitor_message"],
        retrieved_chunks=chunks,
        conversation_history=state.get("conversation_history", []),
        brand_name=brand_name,
    )
    system_prompt = rag_payload["system_instruction"]
    api_messages = rag_payload["messages"]

    import os
    groq_api_key = getattr(settings, "GROQ_API_KEY", "") or os.getenv("GROQ_API_KEY", "")
    openai_api_key = getattr(settings, "OPENAI_API_KEY", "") or os.getenv("OPENAI_API_KEY", "")
    
    # Try calling LLMs (Groq -> OpenAI -> Fallback chunk extraction)
    candidate_configs = []
    if groq_api_key and groq_api_key.startswith("gsk_"):
        candidate_configs.append({"key": groq_api_key, "base_url": GROQ_BASE_URL, "model": "llama-3.3-70b-versatile"})
        candidate_configs.append({"key": groq_api_key, "base_url": GROQ_BASE_URL, "model": "llama-3.1-8b-instant"})
    if openai_api_key and "mock" not in openai_api_key.lower():
        candidate_configs.append({"key": openai_api_key, "base_url": None, "model": "gpt-4o-mini"})

    ans_clean = None
    should_escalate = False

    logger.info(f"[LLM_STARTED] workspace_id={workspace_id} candidates={[c['model'] for c in candidate_configs]}")

    for cfg in candidate_configs:
        try:
            import openai
            if cfg["base_url"]:
                client = openai.OpenAI(api_key=cfg["key"], base_url=cfg["base_url"])
            else:
                client = openai.OpenAI(api_key=cfg["key"])

            resp = client.chat.completions.create(
                model=cfg["model"],
                messages=api_messages,
                temperature=0.1,
                timeout=15.0,
            )
            ans = resp.choices[0].message.content or ""
            if ans.strip():
                ans_clean = ans.strip()
                logger.info(f"[LLM_SUCCESS] workspace_id={workspace_id} model={cfg['model']}")
                break
        except Exception as e:
            logger.warning(f"[LLM_CANDIDATE_FAILED] workspace_id={workspace_id} model={cfg['model']} error=[{type(e).__name__}]: {e}")

    # Fallback to direct Knowledge Chunk Extraction if all LLM API calls fail
    if not ans_clean:
        logger.info(f"[LLM_FALLBACK_EXTRACTION] workspace_id={workspace_id} using direct knowledge chunk extraction")
        extracted_snippets = [c["content"].strip() for c in chunks[:3]]
        combined = "\n\n".join(extracted_snippets)
        if len(combined) > 400:
            combined = combined[:400] + "..."
        ans_clean = f"Based on the uploaded document:\n\n{combined}"
        should_escalate = False

    if f"I don't have information about that in {brand_name}'s knowledge base" in ans_clean or "connect you with someone from the team" in ans_clean:
        should_escalate = True

    return ans_clean, should_escalate
