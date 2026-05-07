"""
Slug health monitoring tasks.

update_slug_health: recalculates health_score for all companies based on
  recent scrape_runs history. health_score = success_runs / total_runs (last 30 days).

prune_dormant_slugs: marks companies inactive when:
  - fail_streak >= settings.slug_fail_streak_threshold (default 10)
  - OR no successful scrape in settings.slug_stale_days (default 30) days
  Logs to slug_health table with auto_pruned=True.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import structlog
from sqlalchemy import func, select, text, update

from jam.config import settings
from jam.tasks.celery_app import app

logger = structlog.get_logger(__name__)


@app.task(
    name="jam.tasks.health_tasks.update_slug_health",
    acks_late=True,
)
def update_slug_health() -> dict:
    return asyncio.run(_async_update_health())


async def _async_update_health() -> dict:
    from jam.database import db_session
    from jam.models import Company, ScrapeRun, SlugHealth

    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=30)
    updated = 0

    async with db_session() as session:
        companies = (await session.execute(select(Company.id))).scalars().all()

        for company_id in companies:
            runs_result = await session.execute(
                select(
                    func.count(ScrapeRun.id).label("total"),
                    func.sum(
                        func.cast(ScrapeRun.status == "success", type_=int)
                    ).label("success"),
                    func.max(ScrapeRun.started_at).label("last_checked"),
                )
                .where(
                    ScrapeRun.company_id == company_id,
                    ScrapeRun.started_at >= cutoff,
                )
            )
            row = runs_result.first()
            if not row or row.total == 0:
                continue

            total = row.total or 0
            success = row.success or 0
            health_score = round(success / total, 3) if total > 0 else None

            # Upsert slug_health
            await session.execute(
                text("""
                    INSERT INTO slug_health (company_id, total_runs, success_runs, health_score, last_checked_at)
                    VALUES (:cid, :total, :success, :score, now())
                    ON CONFLICT (company_id) DO UPDATE SET
                        total_runs = EXCLUDED.total_runs,
                        success_runs = EXCLUDED.success_runs,
                        health_score = EXCLUDED.health_score,
                        last_checked_at = now(),
                        updated_at = now()
                """),
                {"cid": company_id, "total": total, "success": success, "score": health_score},
            )
            updated += 1

    logger.info("slug_health_updated", companies_scored=updated)
    return {"updated": updated}


@app.task(
    name="jam.tasks.health_tasks.prune_dormant_slugs",
    acks_late=True,
)
def prune_dormant_slugs() -> dict:
    return asyncio.run(_async_prune())


async def _async_prune() -> dict:
    from jam.database import db_session
    from jam.models import Company, SlugHealth

    stale_cutoff = datetime.now(tz=timezone.utc) - timedelta(days=settings.slug_stale_days)
    pruned = 0

    async with db_session() as session:
        # Companies with too many consecutive failures
        high_fail = await session.execute(
            select(Company.id)
            .where(
                Company.active == True,
                Company.consecutive_fails >= settings.slug_fail_streak_threshold,
            )
        )
        high_fail_ids = high_fail.scalars().all()

        # Companies with no success for slug_stale_days
        stale = await session.execute(
            select(Company.id)
            .where(
                Company.active == True,
                (Company.last_success_at < stale_cutoff) | Company.last_success_at.is_(None),
            )
        )
        stale_ids = stale.scalars().all()

        to_prune = set(high_fail_ids) | set(stale_ids)

        if to_prune:
            await session.execute(
                update(Company)
                .where(Company.id.in_(to_prune))
                .values(active=False, pruned_at=datetime.now(tz=timezone.utc))
            )
            await session.execute(
                text("""
                    UPDATE slug_health
                    SET auto_pruned=true, pruned_at=now()
                    WHERE company_id = ANY(:ids)
                """),
                {"ids": list(to_prune)},
            )
            pruned = len(to_prune)

    logger.info("slugs_pruned", count=pruned, high_fail=len(high_fail_ids), stale=len(stale_ids))
    return {"pruned": pruned}
