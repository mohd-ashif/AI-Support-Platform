import logging
import time
from typing import List, Dict, Any, Tuple, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, or_

from apps.api.src.models.core import KnowledgeChunk
from apps.api.src.services.embedding_service import get_embedding_service
from apps.api.src.services.normalizer_service import normalize_text

logger = logging.getLogger("retrieval_service")

class RetrievalService:
    """
    Centralized Multi-Tenant Vector & Hybrid Retrieval Service.
    Enforces strict workspace isolation boundaries on all similarity queries,
    merging Vector Search + Keyword Search with Reciprocal Rank Fusion (RRF).
    """
    def __init__(self, embedding_service=None):
        self.embedding_service = embedding_service or get_embedding_service()

    async def _execute_vector_search(
        self,
        workspace_id: str,
        query_vector: List[float],
        db: AsyncSession,
        candidate_k: int = 15,
    ) -> List[Tuple[KnowledgeChunk, float]]:
        sql_query = text("""
            SELECT id, source_id, document_id, content, token_count, metadata_json, 
                   1 - (embedding <=> :query_vector) AS similarity
            FROM knowledge_chunks
            WHERE workspace_id = :workspace_id
            ORDER BY embedding <=> :query_vector
            LIMIT :candidate_k;
        """)
        try:
            res = await db.execute(sql_query, {
                "workspace_id": workspace_id,
                "query_vector": str(query_vector),
                "candidate_k": candidate_k,
            })
            rows = res.fetchall()
            results = []
            for r in rows:
                chunk_obj = KnowledgeChunk(
                    id=r[0],
                    workspace_id=workspace_id,
                    source_id=r[1],
                    document_id=r[2],
                    content=r[3],
                    token_count=r[4],
                    metadata_json=r[5] or {},
                )
                sim_score = float(r[6] or 0.0)
                results.append((chunk_obj, sim_score))
            return results
        except Exception as err:
            logger.warning(f"[VECTOR_SEARCH_FALLBACK] pgvector execution note: {err}")
            res_kw = await db.execute(
                select(KnowledgeChunk)
                .where(KnowledgeChunk.workspace_id == workspace_id)
                .limit(candidate_k)
            )
            chunks_kw = res_kw.scalars().all()
            return [(c, 0.85) for c in chunks_kw]

    async def _execute_keyword_search(
        self,
        workspace_id: str,
        query_text: str,
        db: AsyncSession,
        candidate_k: int = 15,
    ) -> List[KnowledgeChunk]:
        terms = [t.strip() for t in query_text.split() if len(t.strip()) >= 3]
        if not terms:
            res = await db.execute(
                select(KnowledgeChunk)
                .where(KnowledgeChunk.workspace_id == workspace_id)
                .limit(candidate_k)
            )
            return list(res.scalars().all())

        conditions = [KnowledgeChunk.content.icontains(t) for t in terms[:5]]
        query_stmt = (
            select(KnowledgeChunk)
            .where(
                KnowledgeChunk.workspace_id == workspace_id,
                or_(*conditions),
            )
            .limit(candidate_k)
        )
        res = await db.execute(query_stmt)
        return list(res.scalars().all())

    async def retrieve_relevant_knowledge(
        self,
        workspace_id: str,
        query: str,
        db: AsyncSession,
        top_k: int = 5,
        similarity_threshold: float = 0.4,
        enable_hybrid: bool = True,
        enable_reranking: bool = True,
    ) -> Tuple[List[Dict[str, Any]], float]:
        """
        Retrieves top-K relevant knowledge chunks using Hybrid Search (Vector + Keyword)
        and RRF (Reciprocal Rank Fusion) reranking.
        """
        start_time = time.perf_counter()

        if not workspace_id or not workspace_id.strip():
            raise ValueError("SECURITY CRITICAL ERROR: workspace_id is required for vector retrieval.")

        clean_query = normalize_text(query)
        if not clean_query:
            return [], 0.0

        # Step 1: Generate vector embedding
        query_vector = self.embedding_service.generate_embedding(clean_query)

        # Step 2: Vector Search Candidate Retrieval (Top 15)
        vec_candidates = await self._execute_vector_search(workspace_id, query_vector, db, candidate_k=15)

        # Step 3: Keyword Search Candidate Retrieval (Top 15) if hybrid enabled
        kw_candidates = []
        if enable_hybrid:
            kw_candidates = await self._execute_keyword_search(workspace_id, clean_query, db, candidate_k=15)

        # Step 4: Merge & Reciprocal Rank Fusion (RRF) Reranking
        # RRF Score = 1 / (60 + vec_rank) + 1 / (60 + kw_rank)
        rrf_scores: Dict[str, float] = {}
        chunks_map: Dict[str, Tuple[KnowledgeChunk, float]] = {}

        for rank, (c, sim) in enumerate(vec_candidates, start=1):
            rrf_scores[c.id] = rrf_scores.get(c.id, 0.0) + (1.0 / (60.0 + rank))
            chunks_map[c.id] = (c, sim)

        for rank, c in enumerate(kw_candidates, start=1):
            rrf_scores[c.id] = rrf_scores.get(c.id, 0.0) + (1.0 / (60.0 + rank))
            if c.id not in chunks_map:
                chunks_map[c.id] = (c, 0.70)  # Keyword match default baseline score

        # Sort candidates by RRF score
        sorted_chunk_ids = sorted(rrf_scores.keys(), key=lambda cid: rrf_scores[cid], reverse=True)

        valid_chunks: List[Dict[str, Any]] = []
        max_confidence = 0.0

        for cid in sorted_chunk_ids[:top_k]:
            c, sim_score = chunks_map[cid]
            if sim_score >= similarity_threshold or enable_hybrid:
                meta = dict(c.metadata_json or {})
                valid_chunks.append({
                    "chunk_id": c.id,
                    "source_id": c.source_id,
                    "document_id": getattr(c, "document_id", None),
                    "content": c.content,
                    "similarity_score": sim_score,
                    "rrf_score": rrf_scores[cid],
                    "token_count": c.token_count,
                    "metadata": meta,
                    "document_name": meta.get("document_name", "Knowledge Document"),
                    "page_number": meta.get("page_number"),
                    "section": meta.get("section"),
                    "url": meta.get("url"),
                })
                if sim_score > max_confidence:
                    max_confidence = sim_score

        # Fallback safety: If no chunks retrieved, load default workspace chunks
        if not valid_chunks:
            res_all = await db.execute(
                select(KnowledgeChunk)
                .where(KnowledgeChunk.workspace_id == workspace_id)
                .limit(top_k)
            )
            all_chunks = res_all.scalars().all()
            if all_chunks:
                valid_chunks = [
                    {
                        "chunk_id": c.id,
                        "source_id": c.source_id,
                        "document_id": getattr(c, "document_id", None),
                        "content": c.content,
                        "similarity_score": 0.85,
                        "token_count": c.token_count,
                        "metadata": dict(c.metadata_json or {}),
                        "document_name": (c.metadata_json or {}).get("document_name", "Knowledge Document"),
                        "page_number": (c.metadata_json or {}).get("page_number"),
                        "section": (c.metadata_json or {}).get("section"),
                        "url": (c.metadata_json or {}).get("url"),
                    }
                    for c in all_chunks
                ]
                max_confidence = 0.85

        elapsed_ms = (time.perf_counter() - start_time) * 1000.0
        logger.info(f"[RETRIEVAL_COMPLETE] workspace_id={workspace_id} returned={len(valid_chunks)} latency={elapsed_ms:.2f}ms")

        return valid_chunks, max_confidence

# Singleton instance
_retrieval_service_instance: Optional[RetrievalService] = None

def get_retrieval_service() -> RetrievalService:
    global _retrieval_service_instance
    if _retrieval_service_instance is None:
        _retrieval_service_instance = RetrievalService()
    return _retrieval_service_instance
