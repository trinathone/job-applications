"""
Health endpoints:
  GET /api/health   — component health (DB, Redis, Celery)
  GET /api/ready    — readiness probe
  GET /api/admin/scrape-health — last 7 days of scrape run stats
"""
from __future__ import annotations

import asyncio

from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from jam.monitoring.health import check_celery, check_db, check_redis, get_last_scrape_run
from jam.schemas import HealthResponse, ScrapeHealthResponse

router = APIRouter(tags=["health"])


@router.get("/api/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    from jam.schemas import ComponentHealth as CH

    db_h, redis_h, celery_h = await asyncio.gather(check_db(), check_redis(), check_celery())

    overall = "ok"
    if db_h.status == "down":
        overall = "down"
    elif redis_h.status == "down" or celery_h.status == "degraded":
        overall = "degraded"

    last_scrape = await get_last_scrape_run()

    return HealthResponse(
        status=overall,
        db=db_h,
        redis=redis_h,
        celery=celery_h,
        last_scrape_run=last_scrape,
    )


@router.get("/api/ready")
async def readiness():
    db_h = await check_db()
    if db_h.status == "down":
        return JSONResponse(status_code=503, content={"ready": False, "reason": "db_down"})
    return {"ready": True}


@router.get("/api/admin/scrape-health", response_model=ScrapeHealthResponse)
async def scrape_health(days: int = Query(default=7, ge=1, le=30)) -> ScrapeHealthResponse:
    from datetime import datetime, timedelta, timezone

    from sqlalchemy import func, select

    from jam.database import db_session
    from jam.models import Company, ScrapeRun

    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=days)

    async with db_session() as session:
        runs = (await session.execute(
            select(ScrapeRun).where(ScrapeRun.started_at >= cutoff)
            .order_by(ScrapeRun.started_at.desc()).limit(500)
        )).scalars().all()

        dead_count = (await session.execute(
            select(func.count(Company.id)).where(Company.active == False)
        )).scalar() or 0

        dormant_count = (await session.execute(
            select(func.count(Company.id)).where(
                Company.active == True, Company.consecutive_fails >= 5
            )
        )).scalar() or 0

    from jam.schemas import ScrapeRunOut
    total = len(runs)
    success_count = sum(1 for r in runs if r.status == "success")

    return ScrapeHealthResponse(
        runs_last_7d=[ScrapeRunOut.model_validate(r) for r in runs[:100]],
        success_rate_7d=round(success_count / total, 3) if total else 0.0,
        avg_jobs_per_run=round(sum(r.jobs_new for r in runs) / total, 1) if total else 0.0,
        dead_slugs_count=dead_count,
        dormant_slugs_count=dormant_count,
    )
