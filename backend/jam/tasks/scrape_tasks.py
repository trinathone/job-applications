"""
Celery scrape tasks.

Idempotency: task_id includes the date+hour, so a restart within the same
hour window doesn't double-fire. Celery deduplicates by task_id at the broker.

acks_late=True: task is re-queued if the worker process is killed mid-scrape.
This is safe because the pipeline is idempotent (ON CONFLICT DO UPDATE).
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import structlog
from celery import Task

from jam.tasks.celery_app import app

logger = structlog.get_logger(__name__)


def _today_hour() -> str:
    now = datetime.now(tz=timezone.utc)
    return now.strftime("%Y%m%d-%H")


@app.task(
    bind=True,
    name="jam.tasks.scrape_tasks.run_morning_scrape",
    max_retries=2,
    default_retry_delay=300,    # 5 minutes between retries
    acks_late=True,
    reject_on_worker_lost=True,
    task_id_prefix="morning-scrape",
)
def run_morning_scrape(self: Task) -> dict:
    """
    Full pipeline scrape task.
    Idempotent task_id: one fire per UTC hour slot.
    """
    run_id = f"scrape-{_today_hour()}-{self.request.id[:8]}"
    logger.info("scrape_task_start", run_id=run_id, task_id=self.request.id)

    try:
        from jam.scraper.pipeline import run_full_pipeline

        stats = asyncio.run(run_full_pipeline(run_id=run_id))

        result = {
            "run_id": run_id,
            "jobs_new": stats.jobs_new,
            "jobs_fetched": stats.jobs_fetched,
            "slugs_attempted": stats.slugs_attempted,
            "slugs_dead": stats.slugs_dead,
        }

        logger.info("scrape_task_complete", **result)

        # Chain enrichment for new jobs
        if stats.jobs_new > 0:
            from jam.tasks.enrich_tasks import enrich_pending_jobs
            enrich_pending_jobs.apply_async(
                kwargs={"limit": min(stats.jobs_new + 50, 500)},
                queue="enrich",
                countdown=30,  # small delay to let DB settle
            )

        # Alert if degraded (many dead slugs or low success rate)
        if stats.slugs_dead > 10 or (
            stats.slugs_attempted > 0
            and stats.slugs_ok / stats.slugs_attempted < 0.7
        ):
            from jam.tasks.notify_tasks import alert_scrape_degraded
            alert_scrape_degraded.apply_async(
                kwargs={"stats": result},
                queue="notify",
            )

        return result

    except Exception as exc:
        logger.error("scrape_task_failed", exc=str(exc), run_id=run_id)
        from jam.tasks.notify_tasks import notify_scrape_failure
        notify_scrape_failure.apply_async(
            kwargs={"error": str(exc), "run_id": run_id},
            queue="notify",
        )
        raise self.retry(exc=exc)
