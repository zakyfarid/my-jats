"""JWT-based authentication with super_admin / admin roles."""
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Literal
import bcrypt
import jwt
from fastapi import HTTPException, Header, Depends
from pydantic import BaseModel, Field, EmailStr, ConfigDict

JWT_ALGORITHM = "HS256"
TOKEN_LIFETIME_HOURS = 12


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------- Models ----------
class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: str
    name: str = ""
    role: Literal["super_admin", "admin"] = "admin"
    password_hash: str = ""
    created_at: str = Field(default_factory=_now_iso)


class UserPublic(BaseModel):
    id: str
    email: str
    name: str = ""
    role: str
    created_at: str


class LoginRequest(BaseModel):
    email: str
    password: str


class CreateAdminRequest(BaseModel):
    email: str
    password: str
    name: str = ""


# ---------- Password ----------
def hash_password(password: str) -> str:
    # bcrypt: truncate to 72 bytes to avoid the long-password error in some versions
    pw_bytes = password.encode("utf-8")[:72]
    return bcrypt.hashpw(pw_bytes, bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8")[:72], hashed.encode("utf-8"))
    except Exception:
        return False


# ---------- JWT ----------
def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_token(user_id: str, email: str, role: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_LIFETIME_HOURS),
    }
    return jwt.encode(payload, _secret(), algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, _secret(), algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ---------- FastAPI dependency ----------
async def get_current_user(authorization: Optional[str] = Header(None)) -> dict:
    """Return decoded token payload (basic user info)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = authorization[7:].strip()
    payload = decode_token(token)
    return {
        "id": payload.get("sub"),
        "email": payload.get("email"),
        "role": payload.get("role"),
    }


async def require_super_admin(user: dict = Depends(get_current_user)) -> dict:
    if user.get("role") != "super_admin":
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user
