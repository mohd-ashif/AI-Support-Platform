import pytest
import hmac
import hashlib
from typing import Dict, Any

from apps.api.src.utils.encryption import encrypt_token, decrypt_token
from apps.api.src.services.github_sync_service import redact_secrets, should_index_file, extract_code_symbol
from apps.api.src.services.github_webhook_service import verify_github_webhook_signature
from apps.api.src.services.citation_service import extract_verifiable_citations
from apps.api.src.services.rag_prompt_service import build_rag_prompt


def test_token_encryption_decryption():
    """Verify AES Fernet encryption and decryption of access tokens."""
    token = "gho_1234567890abcdefghijklmnopqrstuvwxyz"
    encrypted = encrypt_token(token)
    assert encrypted != token
    assert isinstance(encrypted, str)

    decrypted = decrypt_token(encrypted)
    assert decrypted == token


def test_secret_redaction_engine():
    """Verify automated secret detection and redaction (API keys, RSA keys, JWTs)."""
    raw_code = """
    const STRIPE_SECRET = "sk_test_mock_dummy_secret_key_12345";
    const GITHUB_PAT = "ghp_mock_dummy_pat_token_12345";
    const DB_URL = "postgresql://admin:super_secret_password@localhost:5432/db";
    const PRIVATE_KEY = "-----BEGIN RSA PRIVATE KEY-----\\nABCDEF123456\\n-----END RSA PRIVATE KEY-----";
    """
    sanitized = redact_secrets(raw_code)

    assert "sk_test_mock_dummy" not in sanitized or "[REDACTED" in sanitized
    assert "ghp_" not in sanitized
    assert "super_secret_password" not in sanitized
    assert "[REDACTED_STRIPE_SECRET]" in sanitized
    assert "[REDACTED_GITHUB_TOKEN]" in sanitized
    assert "[REDACTED_PRIVATE_KEY]" in sanitized


def test_binary_file_and_directory_exclusion():
    """Verify ignore rules filter out binary files, node_modules, and lock files."""
    assert should_index_file("src/auth/auth.service.ts", {}) is True
    assert should_index_file("docs/api.md", {}) is True

    # Binary files & build artifacts
    assert should_index_file("assets/logo.png", {}) is False
    assert should_index_file("dist/bundle.js", {}) is False
    assert should_index_file("node_modules/express/index.js", {}) is False
    assert should_index_file("package-lock.json", {}) is False


def test_code_symbol_extraction():
    """Verify class, interface, function, and markdown heading symbol extraction."""
    assert extract_code_symbol("class AuthService { constructor() {} }") == "AuthService"
    assert extract_code_symbol("interface UserProfile { id: string; }") == "UserProfile"
    assert extract_code_symbol("async function validateToken() {}") == "validateToken"
    assert extract_code_symbol("## Authentication System") == "Authentication System"


def test_webhook_hmac_signature_verification():
    """Verify GitHub webhook HMAC-SHA256 signature verification."""
    secret = "my-secret-webhook-key"
    payload = b'{"ref":"refs/heads/main","repository":{"full_name":"company/app"}}'

    valid_signature = "sha256=" + hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()

    assert verify_github_webhook_signature(payload, valid_signature, secret) is True
    assert verify_github_webhook_signature(payload, "sha256=invalid_signature", secret) is False
    assert verify_github_webhook_signature(payload, None, secret) is False


def test_github_citation_extraction():
    """Verify GitHub source metadata extraction (repo, branch, line ranges, symbols)."""
    chunks = [
        {
            "content": "export class AuthService {}",
            "metadata": {
                "sourceType": "GITHUB",
                "repository": "company/backend",
                "branch": "main",
                "filePath": "src/auth.ts",
                "lineStart": 10,
                "lineEnd": 25,
                "symbol": "AuthService",
                "url": "https://github.com/company/backend/blob/main/src/auth.ts#L10-L25",
            },
        }
    ]

    citations = extract_verifiable_citations(chunks)
    assert len(citations) == 1
    c = citations[0]
    assert c["repository"] == "company/backend"
    assert c["filePath"] == "src/auth.ts"
    assert c["lineStart"] == 10
    assert c["lineEnd"] == 25
    assert c["symbol"] == "AuthService"
    assert "https://github.com" in c["url"]


def test_rag_prompt_developer_grounding():
    """Verify RAG prompt builder enforces developer grounding and GitHub context."""
    chunks = [
        {
            "chunk_id": "c1",
            "content": "AuthService handles JWT token validation.",
            "metadata": {
                "sourceType": "GITHUB",
                "repository": "company/server",
                "filePath": "src/auth/auth.service.ts",
                "lineStart": 50,
                "lineEnd": 80,
                "symbol": "AuthService",
            },
        }
    ]

    rag_data = build_rag_prompt(
        question="Where is JWT validation?",
        retrieved_chunks=chunks,
        brand_name="SupportAI",
    )

    sys_instr = rag_data["system_instruction"]
    assert "SupportAI" in sys_instr
    assert "DEVELOPER & REPOSITORY KNOWLEDGE ASSISTANT RULES" in sys_instr
    assert "src/auth/auth.service.ts" in sys_instr
    assert "L50-L80" in sys_instr
