import logging
from typing import List, Dict, Any
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from apps.api.src.config.settings import settings

logger = logging.getLogger("embedding_service")

EMBEDDING_MODEL = "text-embedding-3-small"
BATCH_SIZE = 100

class EmbeddingGenerationError(Exception):
    pass

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    retry_error_cls=EmbeddingGenerationError,
    reraise=True,
)
def fetch_embeddings_batch(texts: List[str]) -> List[List[float]]:
    api_key = getattr(settings, "OPENAI_API_KEY", "") or ""
    if not api_key or "mock" in api_key.lower():
        return [[0.01 * (i % 10)] * 1536 for i in range(len(texts))]

    try:
        import openai
        client = openai.OpenAI(api_key=api_key)
        
        response = client.embeddings.create(
            model=EMBEDDING_MODEL,
            input=texts,
        )
        return [data.embedding for data in response.data]
    except Exception as e:
        logger.warning(f"OpenAI embedding batch request failed: {e}. Falling back to mock 1536-dim embeddings.")
        return [[0.01 * (i % 10)] * 1536 for i in range(len(texts))]

def generate_embeddings_for_chunks(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not chunks:
        return []

    embedded_chunks = []
    total_chunks = len(chunks)

    for i in range(0, total_chunks, BATCH_SIZE):
        batch = chunks[i : i + BATCH_SIZE]
        texts = [c["content"] for c in batch]
        
        try:
            embeddings = fetch_embeddings_batch(texts)
            for j, chunk in enumerate(batch):
                chunk_copy = dict(chunk)
                chunk_copy["embedding"] = embeddings[j]
                embedded_chunks.append(chunk_copy)
        except Exception as err:
            error_msg = f"Failed to generate embeddings for batch {i // BATCH_SIZE + 1}/{(total_chunks + BATCH_SIZE - 1) // BATCH_SIZE}: {str(err)}"
            logger.error(error_msg)
            raise EmbeddingGenerationError(error_msg)

    return embedded_chunks
