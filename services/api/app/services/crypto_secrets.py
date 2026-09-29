"""Fernet helpers for MFA secrets at rest."""

from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.config import Settings


def _derive_fernet_key(raw: str) -> bytes:
    digest = hashlib.sha256(raw.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def get_fernet(settings: Settings) -> Fernet:
    key_material = settings.mfa_encryption_key or settings.jwt_secret
    if not key_material:
        # Dev-only ephemeral — production fails closed via Settings validator
        key_material = "dev-mfa-encryption-key-not-for-production"
    return Fernet(_derive_fernet_key(key_material))


def encrypt_secret(plaintext: str, settings: Settings) -> str:
    return get_fernet(settings).encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str, settings: Settings) -> str:
    try:
        return get_fernet(settings).decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("Unable to decrypt MFA secret") from exc
