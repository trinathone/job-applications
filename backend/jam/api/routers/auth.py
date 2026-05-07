"""
Auth API

POST /api/auth/register      — create account with email + password
POST /api/auth/login         — authenticate with email + password
GET  /api/auth/me            — current user info (requires JWT)
POST /api/auth/otp/request   — send 6-digit OTP to email
POST /api/auth/otp/verify    — verify OTP, return JWT (creates account if new)
POST /api/auth/google        — verify Google ID token, return JWT (creates account if new)
"""
from __future__ import annotations

import asyncio
import hashlib
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import httpx
import structlog
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from jam.api.auth import create_access_token, hash_password, verify_password
from jam.api.deps import get_current_user, get_db
from jam.config import settings
from jam.models import OtpCode, User

logger = structlog.get_logger(__name__)


def _require_gmail(email: str) -> None:
    """Only @gmail.com addresses are accepted."""
    if not email.lower().endswith("@gmail.com"):
        raise HTTPException(
            status_code=400,
            detail="Only Gmail addresses (@gmail.com) are accepted.",
        )


router = APIRouter(prefix="/api/auth", tags=["auth"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, description="Minimum 8 characters")
    display_name: str | None = Field(default=None, max_length=200)


class LoginBody(BaseModel):
    email: EmailStr
    password: str


class OtpRequestBody(BaseModel):
    email: EmailStr


class OtpVerifyBody(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class GoogleAuthBody(BaseModel):
    credential: str  # Google ID token from GSI client


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
    is_admin: bool = False

    model_config = {"from_attributes": True}


# ── OTP helpers ───────────────────────────────────────────────────────────────

def _generate_otp() -> str:
    """Generate a 6-digit zero-padded code."""
    return str(secrets.randbelow(1_000_000)).zfill(6)


def _hash_otp(code: str) -> str:
    """SHA-256 hash of the code. OTPs are short-lived and rate-limited so SHA-256 is sufficient."""
    return hashlib.sha256(code.encode()).hexdigest()


async def _send_otp_email(to_email: str, code: str) -> None:
    """
    Send the OTP via SMTP.
    If SMTP_HOST is not configured, logs the code to stdout for development use.
    """
    smtp_host = settings.smtp_host
    if not smtp_host:
        # Dev mode: log the OTP so developers can test without SMTP
        logger.info("otp_dev_code", email=to_email, code=code,
                    note="Set SMTP_HOST in .env to enable real email delivery")
        return

    from_addr = settings.from_email or settings.smtp_user
    subject = f"{code} is your JA sign-in code"
    body_text = (
        f"Your JA sign-in code is:\n\n"
        f"  {code}\n\n"
        f"This code expires in 10 minutes. If you didn't request it, ignore this email."
    )
    body_html = f"""
<!DOCTYPE html>
<html>
<body style="font-family:system-ui,sans-serif;background:#000;color:#fff;padding:32px;">
  <div style="max-width:400px;margin:0 auto;">
    <p style="font-size:13px;color:#888;letter-spacing:0.1em;text-transform:uppercase;">JA — Job Applications</p>
    <h1 style="font-size:48px;font-weight:800;letter-spacing:-0.04em;margin:16px 0 8px;">{code}</h1>
    <p style="font-size:14px;color:#aaa;">Your sign-in code. Expires in <strong style="color:#fff;">10 minutes</strong>.</p>
    <p style="font-size:12px;color:#555;margin-top:32px;">If you didn't request this, you can safely ignore it.</p>
  </div>
</body>
</html>
"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_addr
    msg["To"] = to_email
    msg.attach(MIMEText(body_text, "plain"))
    msg.attach(MIMEText(body_html, "html"))

    def _send() -> None:
        with smtplib.SMTP(smtp_host, settings.smtp_port, timeout=10) as server:
            server.ehlo()
            if settings.smtp_port in (587, 465):
                server.starttls()
            if settings.smtp_user:
                server.login(settings.smtp_user, settings.smtp_password)
            server.sendmail(from_addr, [to_email], msg.as_string())

    await asyncio.to_thread(_send)


# ── Password endpoints ────────────────────────────────────────────────────────

@router.post("/register", response_model=TokenOut, status_code=201)
async def register(
    body: RegisterBody,
    db: AsyncSession = Depends(get_db),
) -> TokenOut:
    _require_gmail(body.email)
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(
        email=body.email,
        display_name=body.display_name,
        hashed_password=hash_password(body.password),
    )
    db.add(user)
    await db.flush()

    token = create_access_token(user.id, user.email)
    return TokenOut(access_token=token, user_id=user.id, email=user.email, display_name=user.display_name)


@router.post("/login", response_model=TokenOut)
async def login(
    body: LoginBody,
    db: AsyncSession = Depends(get_db),
) -> TokenOut:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password",
                            headers={"WWW-Authenticate": "Bearer"})

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    token = create_access_token(user.id, user.email)
    return TokenOut(access_token=token, user_id=user.id, email=user.email, display_name=user.display_name)


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)) -> UserOut:
    admin_set = {e.strip().lower() for e in settings.admin_emails if e.strip()}
    is_admin = bool(admin_set) and current_user.email.lower() in admin_set
    out = UserOut.model_validate(current_user)
    out.is_admin = is_admin
    return out


# ── Email OTP endpoints ───────────────────────────────────────────────────────

@router.post("/otp/request", status_code=202)
async def request_otp(
    body: OtpRequestBody,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Send a 6-digit one-time code to the given email.
    Rate-limited: one code per 60 seconds per email address.
    """
    _require_gmail(body.email)
    # Rate limit: block if an unused code was sent in the last 60 seconds
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=60)
    recent_result = await db.execute(
        select(OtpCode)
        .where(OtpCode.email == body.email)
        .where(OtpCode.created_at >= cutoff)
        .where(OtpCode.used.is_(False))
    )
    if recent_result.scalar_one_or_none():
        raise HTTPException(status_code=429, detail="Please wait 60 seconds before requesting another code")

    code = _generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    otp = OtpCode(email=body.email, code_hash=_hash_otp(code), expires_at=expires_at)
    db.add(otp)
    await db.flush()

    try:
        await _send_otp_email(body.email, code)
    except Exception as exc:
        logger.error("otp_email_failed", email=body.email, error=str(exc))
        raise HTTPException(status_code=502, detail="Failed to send email. Please try again.")

    return {"message": "Code sent to your email"}


@router.post("/otp/verify", response_model=TokenOut)
async def verify_otp(
    body: OtpVerifyBody,
    db: AsyncSession = Depends(get_db),
) -> TokenOut:
    """
    Verify the OTP code. On success, return a JWT.
    Creates a user account automatically if the email has never signed in before.
    """
    now = datetime.now(timezone.utc)

    # Find the most recent valid, unused, unexpired OTP for this email
    result = await db.execute(
        select(OtpCode)
        .where(OtpCode.email == body.email)
        .where(OtpCode.used.is_(False))
        .where(OtpCode.expires_at > now)
        .order_by(OtpCode.created_at.desc())
        .limit(1)
    )
    otp = result.scalar_one_or_none()

    if not otp or otp.code_hash != _hash_otp(body.code):
        raise HTTPException(status_code=401, detail="Invalid or expired code")

    # Mark as used immediately (prevents replay)
    otp.used = True
    await db.flush()

    # Find or create the user
    user_result = await db.execute(select(User).where(User.email == body.email))
    user = user_result.scalar_one_or_none()
    if not user:
        # New user via OTP — create without a password
        user = User(email=body.email, hashed_password="")
        db.add(user)
        await db.flush()
        logger.info("user_created_via_otp", email=body.email, user_id=user.id)

    token = create_access_token(user.id, user.email)
    return TokenOut(access_token=token, user_id=user.id, email=user.email, display_name=user.display_name)


# ── Google Sign-In endpoint ───────────────────────────────────────────────────

@router.post("/google", response_model=TokenOut)
async def google_auth(
    body: GoogleAuthBody,
    db: AsyncSession = Depends(get_db),
) -> TokenOut:
    """
    Verify a Google ID token (from the GSI JS library) and return a JWT.
    Creates a user account automatically if this Google email has never signed in before.

    Requires GOOGLE_CLIENT_ID to be set in .env.
    """
    client_id = settings.google_client_id
    if not client_id:
        raise HTTPException(status_code=503, detail="Google Sign-In is not configured on this server")

    # Verify the credential with Google's tokeninfo endpoint
    # This is the recommended approach without needing the google-auth package.
    async with httpx.AsyncClient(timeout=10.0) as http:
        resp = await http.get(
            "https://oauth2.googleapis.com/tokeninfo",
            params={"id_token": body.credential},
        )

    if resp.status_code != 200:
        logger.warning("google_tokeninfo_failed", status=resp.status_code)
        raise HTTPException(status_code=401, detail="Invalid Google credential")

    payload = resp.json()

    # Verify the token was issued for our app
    token_aud = payload.get("aud", "")
    if token_aud != client_id:
        logger.warning("google_aud_mismatch", got=token_aud, expected=client_id)
        raise HTTPException(status_code=401, detail="Token audience does not match")

    # Belt-and-suspenders: verify expiry (Google already checks this, but be explicit)
    exp = int(payload.get("exp", 0))
    if exp < datetime.now(timezone.utc).timestamp():
        raise HTTPException(status_code=401, detail="Google token has expired")

    # Require a verified email
    email_verified = payload.get("email_verified")
    if email_verified not in (True, "true"):
        raise HTTPException(status_code=401, detail="Google email is not verified")

    email: str = payload.get("email", "").lower()
    _require_gmail(email)
    display_name: str | None = payload.get("name")

    if not email:
        raise HTTPException(status_code=400, detail="No email in Google token")

    # Find or create user
    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()
    if not user:
        user = User(email=email, display_name=display_name, hashed_password="")
        db.add(user)
        await db.flush()
        logger.info("user_created_via_google", email=email, user_id=user.id)
    elif display_name and not user.display_name:
        # Backfill name if we got it from Google and the user doesn't have one yet
        user.display_name = display_name

    token = create_access_token(user.id, user.email)
    return TokenOut(access_token=token, user_id=user.id, email=user.email, display_name=user.display_name)
