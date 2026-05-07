"""Weekly digest generation task."""
from __future__ import annotations

import asyncio
from datetime import date, timedelta

import structlog
from sqlalchemy import func, select, text

from jam.tasks.celery_app import app

logger = structlog.get_logger(__name__)


@app.task(name="jam.tasks.weekly_review_tasks.generate_weekly_digest", acks_late=True)
def generate_weekly_digest() -> dict:
    return asyncio.run(_async_generate())


async def _async_generate() -> dict:
    from jam.database import db_session
    from jam.models import Application, User, WeeklyDigest

    today = date.today()
    monday = today - timedelta(days=today.weekday())  # start of this week

    async with db_session() as session:
        users = (await session.execute(select(User.id).where(User.is_active == True))).scalars().all()

    generated = 0
    for user_id in users:
        async with db_session() as session:
            apps_result = await session.execute(
                text("""
                    SELECT a.status, COUNT(*) as cnt
                    FROM applications a
                    WHERE a.user_id = :uid
                      AND a.session_date >= :monday
                    GROUP BY a.status
                """),
                {"uid": user_id, "monday": monday},
            )
            app_counts = {row.status: row.cnt for row in apps_result.all()}

            total_applied = app_counts.get("applied", 0)
            total_scraped_result = await session.execute(
                text("SELECT COUNT(*) FROM jobs WHERE DATE(scraped_at) >= :monday"),
                {"monday": monday},
            )
            total_scraped = total_scraped_result.scalar() or 0

            # Upsert weekly digest record
            await session.execute(
                text("""
                    INSERT INTO weekly_digests (user_id, week_start, jobs_scraped, jobs_applied, applications_json)
                    VALUES (:uid, :week, :scraped, :applied, :apps::jsonb)
                    ON CONFLICT (user_id, week_start) DO UPDATE SET
                        jobs_scraped = EXCLUDED.jobs_scraped,
                        jobs_applied = EXCLUDED.jobs_applied,
                        applications_json = EXCLUDED.applications_json,
                        generated_at = now()
                """),
                {
                    "uid": user_id,
                    "week": monday,
                    "scraped": total_scraped,
                    "applied": total_applied,
                    "apps": __import__("json").dumps(app_counts),
                },
            )
            generated += 1

    logger.info("weekly_digests_generated", count=generated, week_start=monday.isoformat())
    return {"generated": generated, "week_start": monday.isoformat()}
