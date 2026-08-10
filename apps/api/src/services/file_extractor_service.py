import io
import logging
from typing import Tuple
import chardet
import pandas as pd
import pdfplumber

logger = logging.getLogger("file_extractor_service")

MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5MB

class FileExtractionError(Exception):
    pass

def validate_magic_bytes_and_extension(filename: str, content_bytes: bytes) -> str:
    if len(content_bytes) > MAX_FILE_SIZE_BYTES:
        raise FileExtractionError("File size exceeds maximum allowed limit of 5MB.")

    ext = filename.split(".")[-1].lower() if "." in filename else ""
    allowed_exts = ("pdf", "csv", "txt", "json", "md", "png", "jpg", "jpeg", "webp", "svg")
    if ext not in allowed_exts:
        raise FileExtractionError(f"Unsupported file extension '.{ext}'. Allowed types: PDF, CSV, TXT, JSON, MD, PNG, JPG, JPEG, WEBP, SVG.")

    # Magic Bytes / Header Validation
    if ext == "pdf":
        if not content_bytes.startswith(b"%PDF-"):
            raise FileExtractionError("Invalid PDF file: Magic bytes mismatch (%PDF- header missing).")

    return ext

def extract_text_from_file(filename: str, content_bytes: bytes) -> Tuple[str, int]:
    ext = validate_magic_bytes_and_extension(filename, content_bytes)
    extracted_text = ""

    try:
        if ext == "pdf":
            with pdfplumber.open(io.BytesIO(content_bytes)) as pdf:
                page_texts = []
                for page in pdf.pages:
                    txt = page.extract_text()
                    if txt and txt.strip():
                        page_texts.append(txt.strip())
                extracted_text = "\n\n".join(page_texts)

        elif ext in ("png", "jpg", "jpeg", "webp", "svg"):
            extracted_text = f"Image Media File: {filename}"
        elif ext in ("txt", "json", "md", "csv"):
            detected = chardet.detect(content_bytes)
            encoding = detected.get("encoding") or "utf-8"
            try:
                extracted_text = content_bytes.decode(encoding)
            except Exception:
                extracted_text = content_bytes.decode("utf-8", errors="ignore")

    except FileExtractionError:
        raise
    except Exception as e:
        logger.error(f"Text extraction failed for {filename}: {e}")
        raise FileExtractionError(f"Failed to extract text from {filename}: {str(e)}")

    extracted_text_clean = extracted_text.strip()
    if not extracted_text_clean:
        extracted_text_clean = f"Media Document: {filename}"

    return extracted_text_clean, len(content_bytes)
