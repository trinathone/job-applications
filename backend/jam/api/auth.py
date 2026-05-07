"""
JWT creation/validation and password hashing utilities.

Tokens are signed HS256 JWTs with a 7-day expiry.
Passwords are hashed with bcrypt (via passlib).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

from jam.config import settings

_ACCESS_TOKEN_TTL_MINUTES = 60 * 24 * 7  # 7 days

# pbkdf2_sha256: pure-Python, no C bcrypt extension needed.
# Avoids passlib 1.7.4 / bcrypt 5.x incompatibility (bcrypt 5 rejects the
# >72-byte wrap-bug probe that passlib runs on startup).
# PBKDF2-SHA256 at 260,000 rounds (passlib default) is NIST-compliant and secure.
_pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")


# ── Passwords ──────────────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return _pwd_context.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return _pwd_context.verify(plain, hashed)


# ── Tokens ─────────────────────────────────────────────────────────────────────

def create_access_token(user_id: int, email: str) -> str:
    """Create a signed JWT for the given user."""
    expire = datetime.now(tz=timezone.utc) + timedelta(minutes=_ACCESS_TOKEN_TTL_MINUTES)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": expire,
        "iat": datetime.now(tz=timezone.utc),
    }
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def decode_access_token(token: str) -> Optional[dict]:
    """
    Decode and validate a JWT.
    Returns the payload dict on success, None on any failure.
    """
    try:
        return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
    except JWTError:
        return None
