from datetime import timedelta, datetime, timezone
import time
import pytest
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token
)


def test_password_hashing():
    password = "SuperSecretPassword123"
    hashed = hash_password(password)
    assert hashed != password
    assert verify_password(password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False


def test_jwt_token_flow():
    user_payload = {"sub": "42", "email": "test@flagforge.io"}
    token = create_access_token(user_payload)
    assert isinstance(token, str)

    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "42"
    assert decoded["email"] == "test@flagforge.io"


def test_jwt_expired_token_returns_none():
    """(1) Expired access token must return None when decoded."""
    payload = {"sub": "99", "email": "expired@flagforge.io"}
    # Token expired 10 seconds ago
    expired_token = create_access_token(payload, expires_delta=timedelta(seconds=-10))

    decoded = decode_access_token(expired_token)
    assert decoded is None


def test_jwt_invalid_or_tampered_token_returns_none():
    """(2) Tampered signature or garbage string returns None."""
    garbage_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature"
    assert decode_access_token(garbage_token) is None
    assert decode_access_token("") is None
    assert decode_access_token("not-a-token") is None
