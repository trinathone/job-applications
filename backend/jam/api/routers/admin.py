"""
Admin endpoints — user list and activity.
Only accessible with an email in ADMIN_EMAILS plus ADMIN_PANEL_PASSWORD.
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from jam.api.deps import get_db
from jam.config import settings
from jam.models import Application, User, VisitorLead

router = APIRouter(prefix="/api/admin", tags=["admin"])


class UserSummary(BaseModel):
    id: int
    email: str
    display_name: Optional[str]
    is_active: bool
    joined: datetime
    total_applied: int
    last_applied: Optional[datetime]

    model_config = {"from_attributes": True}


class VisitorSummary(BaseModel):
    id: int
    name: str
    email: str
    role: str
    joined: datetime

    model_config = {"from_attributes": True}


async def _require_admin(
    x_admin_email: str | None = Header(default=None),
    x_admin_password: str | None = Header(default=None),
) -> None:
    admins = {e.strip().lower() for e in settings.admin_emails if e.strip()}
    email = (x_admin_email or "").strip().lower()
    if not admins or email not in admins:
        raise HTTPException(status_code=403, detail="Admin access required.")
    if settings.admin_panel_password and x_admin_password != settings.admin_panel_password:
        raise HTTPException(status_code=403, detail="Admin password required.")


@router.get("/users", response_model=list[UserSummary])
async def list_users(
    db: AsyncSession = Depends(get_db),
    _admin: User = Depends(_require_admin),
) -> list[UserSummary]:
    # Users with their application counts and last applied date
    result = await db.execute(
        select(
            User,
            func.count(Application.id).label("total_applied"),
            func.max(Application.applied_at).label("last_applied"),
        )
        .outerjoin(Application, (Application.user_id == User.id) & (Application.status == "applied"))
        .group_by(User.id)
        .order_by(User.created_at.desc())
    )
    rows = result.all()
    return [
        UserSummary(
            id=row.User.id,
            email=row.User.email,
            display_name=row.User.display_name,
            is_active=row.User.is_active,
            joined=row.User.created_at,
            total_applied=row.total_applied or 0,
            last_applied=row.last_applied,
        )
        for row in rows
    ]


@router.get("/visitors", response_model=list[VisitorSummary])
async def list_visitors(
    db: AsyncSession = Depends(get_db),
    _admin: None = Depends(_require_admin),
) -> list[VisitorSummary]:
    result = await db.execute(
        select(VisitorLead)
        .order_by(VisitorLead.created_at.desc())
        .limit(500)
    )
    visitors = result.scalars().all()
    return [
        VisitorSummary(
            id=v.id,
            name=v.name,
            email=v.email,
            role=v.role,
            joined=v.created_at,
        )
        for v in visitors
    ]
