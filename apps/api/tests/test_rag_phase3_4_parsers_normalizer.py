import pytest
from apps.api.src.services.file_extractor_service import (
    parse_pdf_with_page_info,
    parse_docx_with_structure,
    parse_csv_to_meaningful_records,
    extract_text_from_file,
    validate_magic_bytes_and_extension,
    FileExtractionError,
)
from apps.api.src.services.normalizer_service import normalize_text, extract_chunk_metadata

def test_01_csv_meaningful_records_parser():
    csv_bytes = b"Product,Price,Status\nWidget A,10.99,In Stock\nWidget B,25.00,Out of Stock"
    parsed_text, file_size = extract_text_from_file("products.csv", csv_bytes)

    assert file_size == len(csv_bytes)
    assert "[Record 1]" in parsed_text
    assert "Product: Widget A" in parsed_text
    assert "Price: 10.99" in parsed_text
    assert "[Record 2]" in parsed_text
    assert "Status: Out of Stock" in parsed_text

def test_02_text_normalizer():
    raw_dirty_text = "  Heading 1  \n\n\n\nSubtext line 1 \r\n\r\n\x00Subtext line 2   "
    normalized = normalize_text(raw_dirty_text)

    assert "\r" not in normalized
    assert "\x00" not in normalized
    assert "\n\n\n" not in normalized
    assert "Heading 1" in normalized
    assert "Subtext line 1" in normalized

def test_03_chunk_metadata_extraction():
    chunk_text = "--- Page 4 ---\n## Refund Policy Section\nCustomers can request a refund within 30 days."
    meta = extract_chunk_metadata(
        chunk_text=chunk_text,
        workspace_id="ws_123",
        document_id="doc_456",
        source_type="FILE",
        document_name="Terms.pdf",
        url="https://example.com/terms",
    )

    assert meta["workspace_id"] == "ws_123"
    assert meta["document_id"] == "doc_456"
    assert meta["page_number"] == 4
    assert meta["section"] == "Refund Policy Section"
    assert meta["document_name"] == "Terms.pdf"
