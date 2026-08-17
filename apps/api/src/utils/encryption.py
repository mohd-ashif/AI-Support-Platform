import base64
import hashlib
import logging
from typing import Optional

try:
    from cryptography.fernet import Fernet
    HAS_CRYPTOGRAPHY = True
except ImportError:
    HAS_CRYPTOGRAPHY = False

from apps.api.src.config.settings import settings

logger = logging.getLogger("encryption_util")

def _get_fernet_key(key_material: Optional[str] = None) -> bytes:
    material = key_material or getattr(settings, "ENCRYPTION_KEY", None) or getattr(settings, "SECRET_KEY", "default-secret-key")
    return base64.urlsafe_b64encode(hashlib.sha256(material.encode()).digest())

def encrypt_token(token: str, key_material: Optional[str] = None) -> str:
    """
    Encrypts a secret token string (e.g. GitHub access token) using Fernet symmetric encryption.
    Never exposes plaintext tokens.
    """
    if not token:
        return ""
    key = _get_fernet_key(key_material)
    if HAS_CRYPTOGRAPHY:
        fernet = Fernet(key)
        return fernet.encrypt(token.encode()).decode()
    else:
        key_bytes = hashlib.sha256(key).digest()
        encrypted = bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(token.encode()))
        return "enc_raw_" + base64.urlsafe_b64encode(encrypted).decode()

def decrypt_token(encrypted_token: str, key_material: Optional[str] = None) -> str:
    """
    Decrypts an encrypted token string safely.
    """
    if not encrypted_token:
        return ""
    key = _get_fernet_key(key_material)
    if HAS_CRYPTOGRAPHY and not encrypted_token.startswith("enc_raw_"):
        try:
            fernet = Fernet(key)
            return fernet.decrypt(encrypted_token.encode()).decode()
        except Exception as e:
            logger.error(f"Failed to decrypt token with Fernet: {e}")
            return ""
    elif encrypted_token.startswith("enc_raw_"):
        try:
            raw_b64 = encrypted_token[len("enc_raw_"):]
            encrypted_bytes = base64.urlsafe_b64decode(raw_b64.encode())
            key_bytes = hashlib.sha256(key).digest()
            decrypted = bytes(b ^ key_bytes[i % len(key_bytes)] for i, b in enumerate(encrypted_bytes))
            return decrypted.decode()
        except Exception as e:
            logger.error(f"Failed to decrypt token with raw fallback: {e}")
            return ""
    return ""
