import hashlib
import hmac
import base64
import json
import secrets
from datetime import datetime, timedelta
from typing import Optional, Dict, Any
from app.core.config import settings

def hash_password(password: str) -> str:
    """Hashes a password using PBKDF2 with HMAC-SHA256."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    )
    return f"{salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against the stored hash."""
    if not hashed_password or '$' not in hashed_password:
        return False
    try:
        salt, stored_key = hashed_password.split('$', 1)
        key = hashlib.pbkdf2_hmac(
            'sha256',
            plain_password.encode('utf-8'),
            salt.encode('utf-8'),
            100000
        )
        return hmac.compare_digest(key.hex(), stored_key)
    except Exception:
        return False

def _base64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('utf-8')

def _base64url_decode(data: str) -> bytes:
    padding = '=' * (4 - (len(data) % 4))
    return base64.urlsafe_b64decode(data + padding)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=7))
    to_encode.update({"exp": int(expire.timestamp())})
    
    header = {"alg": "HS256", "typ": "JWT"}
    
    header_json = json.dumps(header, separators=(',', ':')).encode('utf-8')
    payload_json = json.dumps(to_encode, separators=(',', ':')).encode('utf-8')
    
    encoded_header = _base64url_encode(header_json)
    encoded_payload = _base64url_encode(payload_json)
    
    signature_input = f"{encoded_header}.{encoded_payload}".encode('utf-8')
    signature = hmac.new(
        settings.JWT_SECRET.encode('utf-8'),
        signature_input,
        hashlib.sha256
    ).digest()
    
    encoded_signature = _base64url_encode(signature)
    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and verifies a signed JWT access token."""
    try:
        parts = token.split('.')
        if len(parts) != 3:
            return None
        
        encoded_header, encoded_payload, encoded_signature = parts
        signature_input = f"{encoded_header}.{encoded_payload}".encode('utf-8')
        
        expected_signature = hmac.new(
            settings.JWT_SECRET.encode('utf-8'),
            signature_input,
            hashlib.sha256
        ).digest()
        
        actual_signature = _base64url_decode(encoded_signature)
        if not hmac.compare_digest(expected_signature, actual_signature):
            return None
        
        payload_json = _base64url_decode(encoded_payload).decode('utf-8')
        payload = json.loads(payload_json)
        
        # Check expiration
        if "exp" in payload:
            if datetime.utcnow().timestamp() > payload["exp"]:
                return None
                
        return payload
    except Exception:
        return None

def get_current_actor(authorization: Optional[str] = None, x_actor_email: Optional[str] = None) -> str:
    """Extracts actor email from Authorization token, header, or defaults to t371899@gmail.com."""
    if x_actor_email:
        return x_actor_email.strip()
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload:
            return payload.get("email") or payload.get("sub") or "t371899@gmail.com"
    return "t371899@gmail.com"

