"""
Job listing API — keyset-paginated, filterable.

GET /api/jobs
  ?ats=greenhouse|lever|ashby|...
  ?remote=true|false
  ?yoe_max=5
  ?since=2025-01-01T00:00:00Z  (filter by posted_at, falling back to scraped_at)
  ?cursor=<ISO timestamp>        (keyset pagination)
  ?limit=50
  ?include_dead=false
  ?include_duplicate=false
"""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from jam.database import get_db
from jam.models import Company, Job
from jam.schemas import JobListResponse, JobOut

router = APIRouter(prefix="/api/jobs", tags=["jobs"])


@router.get("", response_model=JobListResponse)
async def list_jobs(
    ats: Optional[str] = Query(default=None),
    remote: Optional[bool] = Query(default=None),
    yoe_max: Optional[int] = Query(default=None, ge=0, le=20),
    since: Optional[datetime] = Query(default=None),
    cursor: Optional[datetime] = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    include_dead: bool = Query(default=False),
    include_duplicate: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
) -> JobListResponse:
    """
    Keyset-paginated job feed.
    Latest means the source's posted_at when present, otherwise scraped_at.
    """
    sort_at = func.coalesce(Job.posted_at, Job.scraped_at)
    q = (
        select(Job)
        .options(selectinload(Job.company))
        .join(Company, Job.company_id == Company.id)
        .order_by(sort_at.desc(), Job.id.desc())
    )

    if not include_dead:
        q = q.where(Job.is_dead == False)
    if not include_duplicate:
        q = q.where(Job.is_duplicate == False)
    if ats:
        q = q.where(Job.ats == ats)
    if remote is not None:
        q = q.where(Job.remote == remote)
    if yoe_max is not None:
        q = q.where((Job.yoe_min <= yoe_max) | Job.yoe_min.is_(None))
    if since:
        q = q.where(sort_at >= since)
    if cursor:
        # Keyset: get records older than the cursor
        q = q.where(sort_at < cursor)

    q = q.limit(limit)

    result = await db.execute(q)
    jobs = result.scalars().all()

    next_cursor = (jobs[-1].posted_at or jobs[-1].scraped_at) if jobs else None

    return JobListResponse(
        items=[JobOut.model_validate(j) for j in jobs],
        total=len(jobs),
        cursor=next_cursor,
    )


@router.get("/{job_id}", response_model=JobOut)
async def get_job(job_id: int, db: AsyncSession = Depends(get_db)) -> JobOut:
    from fastapi import HTTPException
    result = await db.execute(select(Job).options(selectinload(Job.company)).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return JobOut.model_validate(job)
