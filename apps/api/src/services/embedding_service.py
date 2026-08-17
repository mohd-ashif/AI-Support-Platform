import os
import logging
from typing import List, Dict, Any, Optional
from tenacity import retry, stop_after_attempt, wait_exponential

from apps.api.src.config.settings import settings

logger = logging.getLogger("embedding_service")

EMBEDDING_MODEL_DEFAULT = "text-embedding-3-small"
BATCH_SIZE_DEFAULT = 100

class EmbeddingGenerationError(Exception):
    pass

class ConfigurationError(Exception):
    pass

class EmbeddingService:
    """
    Centralized Embedding Service Abstraction.
    Provides batching, retries, and mock fallback for vector embeddings.
    """
    def __init__(
        self,
        model_name: str = EMBEDDING_MODEL_DEFAULT,
        batch_size: int = BATCH_SIZE_DEFAULT,
    ):
        self.model_name = model_name
        self.batch_size = batch_size

    def _get_api_key(self) -> str:
        return getattr(settings, "OPENAI_API_KEY", "") or os.getenv("OPENAI_API_KEY", "")

    def _is_mock_enabled(self) -> bool:
        return getattr(settings, "USE_MOCK_EMBEDDINGS", False) or os.getenv("USE_MOCK_EMBEDDINGS", "").lower() in ("true", "1")

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry_error_cls=EmbeddingGenerationError,
        reraise=True,
    )
    def fetch_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        api_key = self._get_api_key()
        use_mock = self._is_mock_enabled()

        if not api_key or "mock" in api_key.lower():
            if use_mock:
                logger.info(f"[EMBEDDING_SERVICE] Generating mock 1536-dim embeddings for {len(texts)} texts.")
                return [[0.01 * (i % 10)] * 1536 for i in range(len(texts))]
            else:
                raise ConfigurationError(
                    "OPENAI_API_KEY is required for production embeddings (text-embedding-3-small). "
                    "Set OPENAI_API_KEY in .env or set USE_MOCK_EMBEDDINGS=true for offline testing."
                )

        try:
            import openai
            client = openai.OpenAI(api_key=api_key)
            response = client.embeddings.create(
                model=self.model_name,
                input=texts,
            )
            return [data.embedding for data in response.data]
        except Exception as e:
            if use_mock:
                logger.warning(f"[EMBEDDING_SERVICE] OpenAI embedding call failed: {e}. Falling back to mock embeddings.")
                return [[0.01 * (i % 10)] * 1536 for i in range(len(texts))]
            raise EmbeddingGenerationError(f"OpenAI Embeddings API call failed: {e}")

    def generate_embedding(self, text: str) -> List[float]:
        """Generate vector embedding for a single string query."""
        results = self.fetch_embeddings_batch([text])
        return results[0] if results else [0.0] * 1536

    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Generate vector embeddings for a list of string texts with batching."""
        if not texts:
            return []

        all_embeddings = []
        for i in range(0, len(texts), self.batch_size):
            batch = texts[i : i + self.batch_size]
            embeddings = self.fetch_embeddings_batch(batch)
            all_embeddings.extend(embeddings)

        return all_embeddings

# Singleton instance
_embedding_service_instance: Optional[EmbeddingService] = None

def get_embedding_service() -> EmbeddingService:
    global _embedding_service_instance
    if _embedding_service_instance is None:
        _embedding_service_instance = EmbeddingService()
    return _embedding_service_instance

# Global helper functions for backward compatibility
def fetch_embeddings_batch(texts: List[str]) -> List[List[float]]:
    return get_embedding_service().fetch_embeddings_batch(texts)

def generate_embeddings_for_chunks(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not chunks:
        return []

    texts = [c["content"] for c in chunks]
    embeddings = get_embedding_service().generate_embeddings(texts)

    embedded_chunks = []
    for idx, chunk in enumerate(chunks):
        chunk_copy = dict(chunk)
        chunk_copy["embedding"] = embeddings[idx]
        embedded_chunks.append(chunk_copy)

    return embedded_chunks
