from typing import List, Dict, Any

def extract_verifiable_citations(chunks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Extracts unique, verifiable source citations from retrieved knowledge chunks.
    Extracts rich GitHub repository metadata (repo, branch, filePath, line range, symbol, deep link)
    without hallucination.
    """
    citations: List[Dict[str, Any]] = []
    seen_sources = set()

    for c in chunks:
        meta = c.get("metadata") or {}
        doc_name = c.get("document_name") or meta.get("document_name") or "Knowledge Source"
        page_num = c.get("page_number") or meta.get("page_number")
        section = c.get("section") or meta.get("section")
        url = c.get("url") or meta.get("url")
        source_type = (c.get("source_type") or meta.get("sourceType") or meta.get("source_type") or "file").upper()

        # Extract GitHub specific fields
        repository = meta.get("repository")
        branch = meta.get("branch")
        file_path = meta.get("filePath") or meta.get("path")
        line_start = meta.get("lineStart")
        line_end = meta.get("lineEnd")
        symbol = meta.get("symbol")
        commit_sha = meta.get("commitSha")

        source_key = f"{source_type}_{repository}_{file_path}_{line_start}_{url}"
        if source_key not in seen_sources:
            seen_sources.add(source_key)
            citations.append({
                "documentName": doc_name,
                "pageNumber": page_num,
                "section": section,
                "url": url,
                "sourceType": source_type,
                "repository": repository,
                "branch": branch,
                "filePath": file_path,
                "lineStart": line_start,
                "lineEnd": line_end,
                "symbol": symbol,
                "commitSha": commit_sha,
            })

    return citations
