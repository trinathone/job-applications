"""
Admin endpoints — user list and activity.
Only accessible to users whose email is in ADMIN_EMAILS (set in .env).
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from jam.api.deps import get_current_user, get_db
from jam.models import Application, User

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


async def _require_admin(current_user: User = Depends(get_current_user)) -> User:
    from jam.config import settings
    admins = {e.strip().lower() for e in settings.admin_emails if e.strip()}
    if admins and current_user.email.lower() not in admins:
        raise HTTPException(status_code=403, detail="Admin access required.")
    return current_user


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
