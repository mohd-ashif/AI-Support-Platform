import pytest
from apps.api.src.services.citation_service import extract_verifiable_citations
from apps.api.src.graph.agent_graph import evaluate_tool_router

def test_01_extract_verifiable_citations():
    chunks = [
        {
            "chunk_id": "c1",
            "document_name": "Return Policy.pdf",
            "page_number": 2,
            "section": "Returns",
            "url": None,
            "source_type": "file",
        },
        {
            "chunk_id": "c2",
            "document_name": "Return Policy.pdf",
            "page_number": 2,
            "section": "Returns",
            "url": None,
            "source_type": "file",
        },
        {
            "chunk_id": "c3",
            "document_name": "Help Article",
            "page_number": None,
            "section": None,
            "url": "https://example.com/help",
            "source_type": "url",
        },
    ]

    citations = extract_verifiable_citations(chunks)

    # Deduplication test: should combine identical c1 and c2
    assert len(citations) == 2
    assert citations[0]["documentName"] == "Return Policy.pdf"
    assert citations[0]["pageNumber"] == 2
    assert citations[1]["url"] == "https://example.com/help"

def test_02_human_handoff_evaluator():
    state_normal = {
        "visitor_message": "What are your business hours?",
        "turn_count_unresolved": 0,
    }
    assert evaluate_tool_router(state_normal, conversation_status="bot") == False

    state_handoff_phrase = {
        "visitor_message": "I want to talk to a human agent please",
        "turn_count_unresolved": 0,
    }
    assert evaluate_tool_router(state_handoff_phrase, conversation_status="bot") == True

    state_3_unresolved = {
        "visitor_message": "Can you fix my invoice?",
        "turn_count_unresolved": 3,
    }
    assert evaluate_tool_router(state_3_unresolved, conversation_status="bot") == True

    state_already_human = {
        "visitor_message": "Hello?",
        "turn_count_unresolved": 0,
    }
    assert evaluate_tool_router(state_already_human, conversation_status="human") == True
