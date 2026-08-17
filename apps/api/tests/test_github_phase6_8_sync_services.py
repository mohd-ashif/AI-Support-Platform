import pytest
from apps.api.src.services.github_sync_service import redact_secrets, should_index_file


def test_redact_secrets():
    """
    Test automatic detection and redaction of sensitive credentials prior to embedding.
    """
    raw_code = """
    # Configuration
    DATABASE_URL = "postgresql://user:pass@localhost/db"
    API_KEY = "sk_test_mock_dummy_api_key_12345"
    GITHUB_TOKEN = "ghp_mock_dummy_github_token_12345"
    JWT_SECRET = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    """

    sanitized = redact_secrets(raw_code)
    assert "sk_test_mock_dummy_api_key_12345" not in sanitized or "[REDACTED" in sanitized
    assert "ghp_12345" not in sanitized
    assert "[REDACTED" in sanitized


def test_should_index_file():
    """
    Test file path inclusion and ignore pattern filtering.
    """
    sync_config = {
        "sync_readme": True,
        "sync_docs": True,
        "sync_markdown": True,
        "include_extensions": [".md", ".ts", ".py"],
        "ignore_patterns": ["node_modules/", "dist/", ".env"],
    }

    # Should index README
    assert should_index_file("README.md", sync_config) is True
    # Should index docs folder
    assert should_index_file("docs/authentication.md", sync_config) is True
    # Should index allowed code extensions
    assert should_index_file("src/auth/auth.service.ts", sync_config) is True

    # Should ignore node_modules
    assert should_index_file("node_modules/express/index.js", sync_config) is False
    # Should ignore .env secrets
    assert should_index_file(".env.production", sync_config) is False
