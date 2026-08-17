import logging
import json
import time
from typing import List, Dict, Any, Optional

logger = logging.getLogger("rag_observability")

def log_rag_metrics(
    request_id: str,
    workspace_id: str,
    conversation_id: str,
    query: str,
    retrieval_time_ms: float,
    embedding_time_ms: float,
    llm_time_ms: float,
    total_time_ms: float,
    chunks_retrieved: int,
    top_score: float,
    model: str,
    token_usage: Dict[str, int],
    source_documents: List[str],
    handoff_triggered: bool,
) -> Dict[str, Any]:
    """
    Structured RAG Observability & Performance Metrics Logger for Phase 23.
    """
    metric_entry = {
        "event": "rag_request_telemetry",
        "requestId": request_id,
        "organizationId": workspace_id,
        "conversationId": conversation_id,
        "retrievalTimeMs": round(retrieval_time_ms, 2),
        "embeddingTimeMs": round(embedding_time_ms, 2),
        "llmTimeMs": round(llm_time_ms, 2),
        "totalTimeMs": round(total_time_ms, 2),
        "chunksRetrieved": chunks_retrieved,
        "topScore": round(top_score, 4),
        "model": model,
        "tokenUsage": token_usage,
        "sourceDocuments": source_documents,
        "handoffTriggered": handoff_triggered,
        "timestamp": time.time(),
    }

    logger.info(f"[RAG_TELEMETRY] {json.dumps(metric_entry)}")
    return metric_entry
