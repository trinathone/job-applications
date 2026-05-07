"""
Cleanup task — runs daily at 03:00 UTC.

Deletes jobs older than 7 days UNLESS the user has applied to them.
Applied jobs are kept forever so you can track your history.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone

import structlog

from jam.tasks.celery_app import app

logger = structlog.get_logger(__name__)


@app.task(
    bind=True,
    name="jam.tasks.cleanup_tasks.cleanup_old_jobs",
    acks_late=True,
)
def cleanup_old_jobs(self) -> dict:
    return asyncio.run(_async_cleanup())


async def _async_cleanup() -> dict:
    from jam.database import db_session
    from sqlalchemy import text

    cutoff = datetime.now(tz=timezone.utc) - timedelta(days=7)

    async with db_session() as session:
        # Delete jobs older than 7 days that nobody has applied to
        result = await session.execute(
            text("""
                DELETE FROM jobs
                WHERE scraped_at < :cutoff
                  AND id NOT IN (
                      SELECT DISTINCT job_id FROM applications
                      WHERE status = 'applied'
                  )
                RETURNING id
            """),
            {"cutoff": cutoff},
        )
        deleted_ids = result.fetchall()
        deleted = len(deleted_ids)

        # Also clean up orphaned scrape_runs older than 7 days
        await session.execute(
            text("DELETE FROM scrape_runs WHERE started_at < :cutoff"),
            {"cutoff": cutoff},
        )

    logger.info("cleanup_complete", deleted_jobs=deleted, cutoff=cutoff.isoformat())
    return {"deleted_jobs": deleted, "cutoff": cutoff.isoformat()}
