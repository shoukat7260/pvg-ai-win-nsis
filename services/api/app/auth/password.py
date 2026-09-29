"""Password hashing — Argon2id via argon2-cffi.

Parameters (OWASP-aligned defaults for interactive logins):
  time_cost=3, memory_cost=65536 (64 MiB), parallelism=4, hash_len=32, salt_len=16
Rehash-on-login: if verify succeeds but check_needs_rehash, upgrade the stored hash.
"""

from __future__ import annotations

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from argon2.low_level import Type

# Documented Argon2id parameters
ARGON2_TIME_COST = 3
ARGON2_MEMORY_COST = 65536  # KiB = 64 MiB
ARGON2_PARALLELISM = 4
ARGON2_HASH_LEN = 32
ARGON2_SALT_LEN = 16

_hasher = PasswordHasher(
    time_cost=ARGON2_TIME_COST,
    memory_cost=ARGON2_MEMORY_COST,
    parallelism=ARGON2_PARALLELISM,
    hash_len=ARGON2_HASH_LEN,
    salt_len=ARGON2_SALT_LEN,
    type=Type.ID,
)


def hash_password(password: str) -> str:
    if not password:
        raise ValueError("Password must not be empty")
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    try:
        return _hasher.check_needs_rehash(password_hash)
    except (InvalidHashError, Exception):
        return True
