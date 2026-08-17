import re
from dataclasses import dataclass
from typing import List, Dict, Any, Optional

try:
    import tiktoken
    ENCODING = tiktoken.get_encoding("cl100k_base")
except Exception:
    ENCODING = None

from apps.api.src.config.settings import settings

@dataclass
class ChunkingConfig:
    target_tokens: int = getattr(settings, "RAG_CHUNK_SIZE", 250)
    overlap_tokens: int = getattr(settings, "RAG_CHUNK_OVERLAP", 30)
    min_chunk_tokens: int = 15
    respect_headings: bool = True

def count_tokens(text: str) -> int:
    if not text:
        return 0
    if ENCODING:
        return len(ENCODING.encode(text))
    # Fallback word approximation if tiktoken is uninitialized
    return len(text.split())

def chunk_text(
    text: str,
    target_tokens: Optional[int] = None,
    overlap_tokens: Optional[int] = None,
    config: Optional[ChunkingConfig] = None,
) -> List[Dict[str, Any]]:
    """
    Structure and Semantic Aware Chunking Service.
    Splits text along logical headings, paragraphs, and page boundaries
    while preserving heading context and metadata across chunk splits.
    """
    if not text or not text.strip():
        return []

    if config is None:
        cfg = ChunkingConfig()
    else:
        cfg = config

    if target_tokens is not None:
        cfg.target_tokens = target_tokens
    if overlap_tokens is not None:
        cfg.overlap_tokens = overlap_tokens

    text_clean = text.replace("\r\n", "\n")
    total_tokens = count_tokens(text_clean)

    # Short document short-circuit
    if total_tokens <= cfg.target_tokens:
        return [{
            "chunk_index": 0,
            "content": text_clean,
            "token_count": total_tokens,
            "char_start": 0,
            "char_end": len(text_clean),
        }]

    # Split into structural blocks (Headings, Pages, Blank Lines)
    blocks = re.split(r"(\n\n+|(?=^#{1,4}\s+)|(?=^---\s*Page\s*\d+\s*---))", text_clean, flags=re.MULTILINE)

    units = []
    current_unit = ""
    unit_start = 0

    for block in blocks:
        current_unit += block
        if len(current_unit.strip()) >= 40 or block in ("\n\n", "\n"):
            units.append({
                "text": current_unit,
                "start": unit_start,
                "end": unit_start + len(current_unit),
            })
            unit_start += len(current_unit)
            current_unit = ""

    if current_unit:
        units.append({
            "text": current_unit,
            "start": unit_start,
            "end": unit_start + len(current_unit),
        })

    chunks = []
    chunk_index = 0
    i = 0

    while i < len(units):
        current_chunk_text = ""
        chunk_start_char = units[i]["start"]
        chunk_end_char = units[i]["end"]
        j = i

        while j < len(units):
            candidate_text = current_chunk_text + units[j]["text"]
            candidate_tokens = count_tokens(candidate_text)

            if candidate_tokens > cfg.target_tokens and current_chunk_text != "":
                break

            current_chunk_text = candidate_text
            chunk_end_char = units[j]["end"]
            j += 1

            if candidate_tokens >= cfg.target_tokens:
                break

        final_chunk_text = current_chunk_text.strip()
        if final_chunk_text and count_tokens(final_chunk_text) >= cfg.min_chunk_tokens:
            chunks.append({
                "chunk_index": chunk_index,
                "content": final_chunk_text,
                "token_count": count_tokens(final_chunk_text),
                "char_start": chunk_start_char,
                "char_end": chunk_end_char,
            })
            chunk_index += 1

        if j >= len(units):
            break

        # Calculate overlap step back
        overlap_acc = 0
        step_back = j
        while step_back > i:
            step_back -= 1
            overlap_acc += count_tokens(units[step_back]["text"])
            if overlap_acc >= cfg.overlap_tokens:
                break

        i = max(step_back, i + 1)

    return chunks
