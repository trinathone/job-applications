"""
Auth API

POST /api/auth/register  — create account, returns JWT immediately
POST /api/auth/login     — authenticate, returns JWT
GET  /api/auth/me        — current user info (requires JWT)
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from jam.api.auth import create_access_token, hash_password, verify_password
from jam.api.deps import get_current_user, get_db
from jam.models import User

router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas (local — auth-specific, not shared in schemas.py) ─────────────────

class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Minimum 8 characters")
    display_name: str | None = Field(default=None, max_length=200)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    display_name: str | None


class UserOut(BaseModel):
    id: int
    email: str
    display_name: str | None
    is_active: bool

    model_config = {"from_attributes": True}


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenOut, status_code=201)
async def register(
    body: RegisterBody,
    db: AsyncSession = Depends(get_db),
) -> TokenOut:
    """
    Create a new account.
    Returns a JWT immediately so the client can start using the API without a
    separate login step.
    """
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        display_name=body.display_name,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()  # populate user.id before commit

    token = create_access_token(user.id, user.email)
    return TokenOut(
        access_token=token,
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )


@router.post("/login", response_model=TokenOut)
async def login(
    body: LoginBody,
    db: AsyncSession = Depends(get_db),
) -> TokenOut:
    """
    Authenticate with email + password and receive a JWT.
    Intentionally returns the same 401 for "user not found" and "wrong password"
    to prevent email enumeration.
    """
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token(user.id, user.email)
    return TokenOut(
        access_token=token,
        user_id=user.id,
        email=user.email,
        display_name=user.display_name,
    )


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Return the currently authenticated user's profile."""
    return UserOut.model_validate(current_user)
