import urllib.request
import urllib.parse
import json
from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel, EmailStr
from typing import Optional
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.core.security import hash_password, verify_password, create_access_token, decode_access_token
from app.models.user import User

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class RegisterRequest(BaseModel):
    email: str
    password: str
    full_name: Optional[str] = None

class LoginRequest(BaseModel):
    email: str
    password: str

class OAuthCallbackRequest(BaseModel):
    code: str
    redirect_uri: Optional[str] = None

@router.post("/register")
def register_user(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Registers a new user with email and password."""
    email = payload.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(status_code=400, detail="Invalid email address")
    if not payload.password or len(payload.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long")

    existing_user = db.query(User).filter(User.email == email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    hashed_pw = hash_password(payload.password)
    new_user = User(
        email=email,
        hashed_password=hashed_pw,
        full_name=payload.full_name or email.split("@")[0],
        provider="email"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token({"sub": str(new_user.id), "email": new_user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "email": new_user.email,
            "full_name": new_user.full_name,
            "provider": new_user.provider,
            "avatar_url": new_user.avatar_url
        }
    }

@router.post("/login")
def login_user(payload: LoginRequest, db: Session = Depends(get_db)):
    """Authenticates user via email and password."""
    email = payload.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.provider != "email" and not user.hashed_password:
        raise HTTPException(
            status_code=400, 
            detail=f"This account was registered using {user.provider.capitalize()}. Please sign in with {user.provider.capitalize()}."
        )

    if not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id), "email": user.email})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "provider": user.provider,
            "avatar_url": user.avatar_url
        }
    }

@router.post("/google/callback")
def google_oauth_callback(payload: OAuthCallbackRequest, db: Session = Depends(get_db)):
    """Exchanges Google authorization code for user profile and issues JWT."""
    try:
        # Step 1: Exchange auth code for access token
        token_url = "https://oauth2.googleapis.com/token"
        token_data = urllib.parse.urlencode({
            "code": payload.code,
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": payload.redirect_uri or settings.GOOGLE_REDIRECT_URI,
            "grant_type": "authorization_code"
        }).encode('utf-8')

        req = urllib.request.Request(token_url, data=token_data, headers={
            'Content-Type': 'application/x-www-form-urlencoded'
        })
        
        with urllib.request.urlopen(req) as resp:
            token_res = json.loads(resp.read().decode('utf-8'))
        
        access_token = token_res.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to retrieve access token from Google")

        # Step 2: Fetch Google user profile
        user_info_url = "https://www.googleapis.com/oauth2/v2/userinfo"
        user_req = urllib.request.Request(user_info_url, headers={
            'Authorization': f'Bearer {access_token}'
        })
        with urllib.request.urlopen(user_req) as user_resp:
            google_user = json.loads(user_resp.read().decode('utf-8'))

        email = google_user.get("email")
        if not email:
            raise HTTPException(status_code=400, detail="Google account does not provide an email address")

        google_sub = google_user.get("id")
        full_name = google_user.get("name") or email.split("@")[0]
        avatar_url = google_user.get("picture")

        # Step 3: Find or create user in DB
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                full_name=full_name,
                avatar_url=avatar_url,
                provider="google",
                provider_id=google_sub
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            # Update user info if needed
            user.provider = user.provider or "google"
            user.provider_id = user.provider_id or google_sub
            if avatar_url:
                user.avatar_url = avatar_url
            db.commit()

        jwt_token = create_access_token({"sub": str(user.id), "email": user.email})
        return {
            "access_token": jwt_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "provider": user.provider,
                "avatar_url": user.avatar_url
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Google Authentication Error: {str(e)}")

@router.post("/github/callback")
def github_oauth_callback(payload: OAuthCallbackRequest, db: Session = Depends(get_db)):
    """Exchanges GitHub authorization code for user profile and issues JWT."""
    try:
        # Step 1: Exchange auth code for access token
        token_url = "https://github.com/login/oauth/access_token"
        token_data = urllib.parse.urlencode({
            "code": payload.code,
            "client_id": settings.GITHUB_CLIENT_ID,
            "client_secret": settings.GITHUB_CLIENT_SECRET,
            "redirect_uri": payload.redirect_uri or settings.GITHUB_REDIRECT_URI
        }).encode('utf-8')

        req = urllib.request.Request(token_url, data=token_data, headers={
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
        })
        
        with urllib.request.urlopen(req) as resp:
            token_res = json.loads(resp.read().decode('utf-8'))
        
        access_token = token_res.get("access_token")
        if not access_token:
            raise HTTPException(status_code=400, detail="Failed to retrieve access token from GitHub")

        # Step 2: Fetch GitHub user profile
        user_info_url = "https://api.github.com/user"
        user_req = urllib.request.Request(user_info_url, headers={
            'Authorization': f'Bearer {access_token}',
            'User-Agent': 'FlagForge-App'
        })
        with urllib.request.urlopen(user_req) as user_resp:
            github_user = json.loads(user_resp.read().decode('utf-8'))

        email = github_user.get("email")
        
        # If GitHub email is private, fetch primary email from /user/emails
        if not email:
            try:
                emails_url = "https://api.github.com/user/emails"
                emails_req = urllib.request.Request(emails_url, headers={
                    'Authorization': f'Bearer {access_token}',
                    'User-Agent': 'FlagForge-App'
                })
                with urllib.request.urlopen(emails_req) as emails_resp:
                    emails_list = json.loads(emails_resp.read().decode('utf-8'))
                    primary = next((e for e in emails_list if e.get("primary")), None)
                    if primary:
                        email = primary.get("email")
                    elif emails_list:
                        email = emails_list[0].get("email")
            except Exception:
                pass

        if not email:
            email = f"{github_user.get('login')}@users.noreply.github.com"

        github_id = str(github_user.get("id"))
        full_name = github_user.get("name") or github_user.get("login")
        avatar_url = github_user.get("avatar_url")

        # Step 3: Find or create user in DB
        user = db.query(User).filter(User.email == email).first()
        if not user:
            user = User(
                email=email,
                full_name=full_name,
                avatar_url=avatar_url,
                provider="github",
                provider_id=github_id
            )
            db.add(user)
            db.commit()
            db.refresh(user)
        else:
            user.provider = user.provider or "github"
            user.provider_id = user.provider_id or github_id
            if avatar_url:
                user.avatar_url = avatar_url
            db.commit()

        jwt_token = create_access_token({"sub": str(user.id), "email": user.email})
        return {
            "access_token": jwt_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
                "provider": user.provider,
                "avatar_url": user.avatar_url
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"GitHub Authentication Error: {str(e)}")

@router.get("/me")
def get_current_user(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)):
    """Fetches profile for the currently authenticated JWT user."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")
    
    token = authorization.split(" ")[1]
    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")

    user_id = int(payload["sub"])
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "provider": user.provider,
        "avatar_url": user.avatar_url
    }


@router.get("/users")
def get_all_users(db: Session = Depends(get_db)):
    """Fetches list of all users registered or signed-in to the platform."""
    users = db.query(User).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name or u.email.split("@")[0],
            "avatar_url": u.avatar_url,
            "provider": u.provider
        }
        for u in users
    ]


def get_current_actor(authorization: Optional[str] = Header(None), db: Session = Depends(get_db)) -> str:
    """Returns the email or full_name of the currently logged in user, or 'admin' as fallback for audit logging."""
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
        payload = decode_access_token(token)
        if payload and "sub" in payload:
            try:
                user_id = int(payload["sub"])
                user = db.query(User).filter(User.id == user_id).first()
                if user:
                    return user.email or user.full_name or f"user_{user.id}"
            except Exception:
                pass
    return "admin"

