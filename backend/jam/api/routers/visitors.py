"""Public visitor capture for the no-login landing page."""
from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.ext.asyncio import AsyncSession

from jam.database import get_db
from jam.models import VisitorLead

router = APIRouter(prefix="/api/visitors", tags=["visitors"])


class VisitorLeadIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: EmailStr
    role: Literal["student", "teacher", "other"]


@router.post("", status_code=201)
async def create_visitor_lead(
    body: VisitorLeadIn,
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    db.add(VisitorLead(
        name=body.name.strip(),
        email=body.email.lower(),
        role=body.role,
    ))
    return {"ok": True}
