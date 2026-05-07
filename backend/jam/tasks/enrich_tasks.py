"""
Enrichment Celery task — YOE extraction via regex only. No AI/LLM.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import structlog
from sqlalchemy import select, update

from jam.tasks.celery_app import app

logger = structlog.get_logger(__name__)

DEFAULT_LIMIT = 500


@app.task(
    bind=True,
    name="jam.tasks.enrich_tasks.enrich_pending_jobs",
    acks_late=True,
    reject_on_worker_lost=True,
)
def enrich_pending_jobs(self, *, limit: int = DEFAULT_LIMIT) -> dict:
    return asyncio.run(_async_enrich(limit=limit))


async def _async_enrich(*, limit: int) -> dict:
    from jam.database import db_session
    from jam.enrichment.experience import extract_yoe
    from jam.models import Job

    stats = {"regex_success": 0, "regex_none": 0, "total": 0}

    async with db_session() as session:
        result = await session.execute(
            select(Job.id, Job.description_raw)
            .where(
                Job.enriched_at.is_(None),
                Job.description_raw.isnot(None),
                Job.is_dead == False,
            )
            .limit(limit)
        )
        rows = result.all()

    if not rows:
        logger.info("enrich_nothing_to_do")
        return stats

    stats["total"] = len(rows)

    async with db_session() as session:
        for job_id, description in rows:
            reg_result = extract_yoe(description or "")
            await session.execute(
                update(Job)
                .where(Job.id == job_id)
                .values(
                    yoe_min=reg_result.yoe_min,
                    yoe_max=reg_result.yoe_max,
                    yoe_source="regex" if reg_result.method == "regex" else "none",
                    enriched_at=datetime.now(tz=timezone.utc),
                    needs_extraction=False,
                )
            )
            if reg_result.method == "regex":
                stats["regex_success"] += 1
            else:
                stats["regex_none"] += 1

    logger.info("enrich_complete", **stats)
    return stats
