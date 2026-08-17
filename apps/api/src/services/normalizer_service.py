import re
from typing import Dict, Any, Optional

def normalize_text(text: str) -> str:
    """
    Text Normalization Pipeline.
    Cleans excessive whitespace, duplicate blank lines, and control characters
    while preserving headings, lists, tables, page markers, and structural layout.
    """
    if not text:
        return ""

    # Normalize line endings
    clean = text.replace("\r\n", "\n").replace("\r", "\n")

    # Remove non-printable control characters (except tab and newline)
    clean = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]", "", clean)

    # Trim trailing whitespace from each line
    lines = [line.rstrip() for line in clean.splitlines()]

    # Collapse 3 or more consecutive blank lines down to 2
    clean_lines = []
    blank_count = 0
    for line in lines:
        if not line.strip():
            blank_count += 1
            if blank_count <= 2:
                clean_lines.append("")
        else:
            blank_count = 0
            clean_lines.append(line)

    normalized = "\n".join(clean_lines).strip()
    return normalized

def extract_chunk_metadata(
    chunk_text: str,
    workspace_id: str,
    document_id: str,
    source_type: str,
    document_name: str,
    url: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Extracts structural metadata (page numbers, section headings) from chunk content
    and packages it for down-stream RAG citations.
    """
    meta: Dict[str, Any] = {
        "workspace_id": workspace_id,
        "document_id": document_id,
        "source_type": source_type,
        "document_name": document_name,
        "url": url,
        "page_number": None,
        "section": None,
    }

    # Detect Page Marker (--- Page N ---)
    page_match = re.search(r"---\s*Page\s*(\d+)\s*---", chunk_text, re.IGNORECASE)
    if page_match:
        try:
            meta["page_number"] = int(page_match.group(1))
        except ValueError:
            pass

    # Detect Heading Section (## Heading Title or === Document: Title ===)
    heading_match = re.search(r"^(?:#{1,4}\s+|===\s*Document:\s*)([^\n=]+)", chunk_text, re.MULTILINE)
    if heading_match:
        meta["section"] = heading_match.group(1).strip()

    return meta
