import pytest
from apps.api.src.services.chunker_service import chunk_text, ChunkingConfig, count_tokens
from apps.api.src.services.embedding_service import get_embedding_service, EmbeddingService

def test_01_configurable_chunking_tokens_and_overlap():
    long_text = "SupportAI provides multi-tenant AI customer support. " * 30
    cfg = ChunkingConfig(target_tokens=50, overlap_tokens=10, min_chunk_tokens=5)
    chunks = chunk_text(long_text, config=cfg)

    assert len(chunks) > 1
    for c in chunks:
        assert c["token_count"] <= 60
        assert "content" in c
        assert "char_start" in c

def test_02_embedding_service_abstraction_mock_fallback():
    # Force mock mode for test verification
    svc = EmbeddingService()
    svc._is_mock_enabled = lambda: True

    vector = svc.generate_embedding("What is the refund policy?")
    assert len(vector) == 1536
    assert isinstance(vector, list)

    batch_vectors = svc.generate_embeddings(["Query 1", "Query 2", "Query 3"])
    assert len(batch_vectors) == 3
    assert len(batch_vectors[0]) == 1536
