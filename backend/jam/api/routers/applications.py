"""
Applications API — idempotent UPSERT on (job_id, user_id).

All endpoints require a valid JWT. user_id is always sourced from the token —
callers cannot act on behalf of other users.

POST /api/applications          — create or update (double-click safe)
PATCH /api/applications/{id}    — update status, notes, got_response
GET /api/applications           — list authenticated user's applications
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from jam.api.deps import get_current_user, get_db
from jam.models import Application, Job, User
from jam.monitoring.metrics import APPLICATIONS_TOTAL
from jam.schemas import ApplicationCreate, ApplicationOut, ApplicationUpdate

router = APIRouter(prefix="/api/applications", tags=["applications"])


@router.post("", response_model=ApplicationOut, status_code=200)
async def upsert_application(
    body: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApplicationOut:
    """
    Idempotent: ON CONFLICT (job_id, user_id) DO UPDATE.
    Calling this twice for the same job is safe — second call is a no-op update.
    user_id is always the authenticated user; cannot be set by the caller.
    """
    values: dict = {
        "job_id": body.job_id,
        "user_id": current_user.id,
        "status": body.status,
        "skip_reason": body.skip_reason,
        "notes": body.notes,
        "cover_letter": body.cover_letter,
    }
    if body.status == "applied":
        values["applied_at"] = datetime.now(tz=timezone.utc)

    stmt = (
        pg_insert(Application)
        .values(**values)
        .on_conflict_do_update(
            constraint="uq_applications_job_user",
            set_={
                "status": body.status,
                "skip_reason": body.skip_reason,
                "notes": body.notes,
                "cover_letter": body.cover_letter,
                "updated_at": datetime.now(tz=timezone.utc),
                **({"applied_at": datetime.now(tz=timezone.utc)} if body.status == "applied" else {}),
            },
        )
        .returning(Application)
    )

    result = await db.execute(stmt)
    app = result.scalar_one()

    APPLICATIONS_TOTAL.labels(status=body.status).inc()

    return ApplicationOut.model_validate(app)


@router.patch("/{application_id}", response_model=ApplicationOut)
async def update_application(
    application_id: int,
    body: ApplicationUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApplicationOut:
    """Update an application — only the owning user can do this."""
    result = await db.execute(
        select(Application).where(
            Application.id == application_id,
            Application.user_id == current_user.id,  # ownership guard
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        setattr(app, field, value)

    if body.status == "applied" and not app.applied_at:
        app.applied_at = datetime.now(tz=timezone.utc)

    app.updated_at = datetime.now(tz=timezone.utc)
    return ApplicationOut.model_validate(app)


@router.get("", response_model=list[ApplicationOut])
async def list_applications(
    status: Optional[str] = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ApplicationOut]:
    """List all applications for the authenticated user, newest first.
    Job title, company name, and URL are eager-loaded for display."""

    q = (
        select(Application)
        .options(
            joinedload(Application.job).joinedload(Job.company)
        )
        .where(Application.user_id == current_user.id)
    )
    if status:
        q = q.where(Application.status == status)
    q = q.order_by(Application.updated_at.desc())

    result = await db.execute(q)
    apps = result.unique().scalars().all()

    out = []
    for a in apps:
        row = ApplicationOut.model_validate(a)
        if a.job:
            row.job_title        = a.job.title
            row.job_url          = a.job.url
            row.job_company_name = a.job.company.name if a.job.company else None
        out.append(row)
    return out
