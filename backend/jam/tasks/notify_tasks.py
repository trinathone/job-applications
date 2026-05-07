"""
Notification tasks — failure alerts and daily digest.

Sends via Telegram bot (same token used by the JAM project's bot).
Falls back to structured log if Telegram is not configured.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Optional

import structlog

from jam.config import settings
from jam.tasks.celery_app import app

logger = structlog.get_logger(__name__)


async def _send_telegram(message: str) -> bool:
    """Send a message to the configured alert chat."""
    if not settings.telegram_bot_token or not settings.telegram_alert_chat_id:
        logger.warning("telegram_not_configured")
        return False

    import aiohttp
    url = f"https://api.telegram.org/bot{settings.telegram_bot_token}/sendMessage"
    payload = {
        "chat_id": settings.telegram_alert_chat_id,
        "text": message,
        "parse_mode": "HTML",
    }

    async with aiohttp.ClientSession() as session:
        resp = await session.post(url, json=payload)
        return resp.status == 200


@app.task(
    name="jam.tasks.notify_tasks.notify_scrape_failure",
    acks_late=True,
    max_retries=1,
)
def notify_scrape_failure(*, error: str, run_id: str) -> None:
    """Alert when a scrape task fails completely."""
    msg = (
        f"🚨 <b>JAM Scrape Failure</b>\n"
        f"Run ID: <code>{run_id}</code>\n"
        f"Error: <code>{error[:500]}</code>\n"
        f"Time: {datetime.now(tz=timezone.utc).isoformat()}"
    )
    logger.error("scrape_failure_notification", run_id=run_id, error=error)
    asyncio.run(_send_telegram(msg))


@app.task(
    name="jam.tasks.notify_tasks.alert_scrape_degraded",
    acks_late=True,
)
def alert_scrape_degraded(*, stats: dict) -> None:
    """Alert when scrape quality is below threshold."""
    msg = (
        f"⚠️ <b>JAM Scrape Degraded</b>\n"
        f"Dead slugs: {stats.get('slugs_dead', 0)}\n"
        f"Attempted: {stats.get('slugs_attempted', 0)}\n"
        f"New jobs: {stats.get('jobs_new', 0)}\n"
        f"Run ID: {stats.get('run_id', 'unknown')}"
    )
    logger.warning("scrape_degraded_notification", **stats)
    asyncio.run(_send_telegram(msg))


@app.task(
    name="jam.tasks.notify_tasks.send_morning_digest",
    acks_late=True,
)
def send_morning_digest() -> None:
    """Send daily digest — only if today's scrape succeeded."""
    asyncio.run(_async_send_digest())


async def _async_send_digest() -> None:
    from jam.database import db_session
    from jam.models import ScrapeRun
    from sqlalchemy import func, select
    from datetime import date

    today = date.today()

    async with db_session() as session:
        # Check if we have a successful scrape today
        result = await session.execute(
            select(func.count(ScrapeRun.id))
            .where(
                func.date(ScrapeRun.started_at) == today,
                ScrapeRun.status == "success",
            )
        )
        success_count = result.scalar() or 0

    if success_count == 0:
        logger.warning("digest_skipped", reason="no_successful_scrape_today")
        await _send_telegram(
            "⏭ <b>JAM Daily Digest Skipped</b>\n"
            "No successful scrape completed today. Check scrape health."
        )
        return

    async with db_session() as session:
        from jam.models import Job
        from sqlalchemy import text

        new_jobs_result = await session.execute(
            text("""
                SELECT COUNT(*) FROM jobs
                WHERE DATE(scraped_at) = CURRENT_DATE AND is_dead = false
            """)
        )
        new_jobs = new_jobs_result.scalar() or 0

    msg = (
        f"☀️ <b>JAM Morning Digest</b>\n"
        f"Date: {today}\n"
        f"New jobs scraped: <b>{new_jobs}</b>\n"
        f"Open dashboard: /dashboard"
    )
    await _send_telegram(msg)
    logger.info("digest_sent", new_jobs=new_jobs)
