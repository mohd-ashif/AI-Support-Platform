from typing import List, Dict, Any

def extract_verifiable_citations(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extracts unique, verifiable source citations from retrieved knowledge chunks.
    Ensures citations strictly match actual retrieved documents without hallucinating.
    """
    citations: List[Dict[str, Any]] = []
    seen_sources = set()

    for c in chunks:
        doc_name = c.get("document_name") or (c.get("metadata") or {}).get("document_name") or "Knowledge Source"
        page_num = c.get("page_number") or (c.get("metadata") or {}).get("page_number")
        section = c.get("section") or (c.get("metadata") or {}).get("section")
        url = c.get("url") or (c.get("metadata") or {}).get("url")
        source_type = c.get("source_type") or (c.get("metadata") or {}).get("source_type") or "file"

        source_key = f"{doc_name}_{page_num}_{url}"
        if source_key not in seen_sources:
            seen_sources.add(source_key)
            citations.append({
                "documentName": doc_name,
                "pageNumber": page_num,
                "section": section,
                "url": url,
                "sourceType": source_type.upper(),
            })

    return citations
