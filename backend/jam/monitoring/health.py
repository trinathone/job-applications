"""Health check logic — used by /api/health and /api/ready endpoints."""
from __future__ import annotations

import time
from typing import Optional

import structlog

from jam.schemas import ComponentHealth

logger = structlog.get_logger(__name__)


async def check_db() -> ComponentHealth:
    t0 = time.monotonic()
    try:
        from jam.database import check_db_connectivity
        ok = await check_db_connectivity()
        latency_ms = int((time.monotonic() - t0) * 1000)
        return ComponentHealth(
            status="ok" if ok else "down",
            latency_ms=latency_ms,
        )
    except Exception as exc:
        return ComponentHealth(status="down", detail=str(exc))


async def check_redis() -> ComponentHealth:
    t0 = time.monotonic()
    try:
        import redis.asyncio as aioredis
        from jam.config import settings
        r = aioredis.from_url(settings.redis_url)
        await r.ping()
        await r.aclose()
        return ComponentHealth(
            status="ok",
            latency_ms=int((time.monotonic() - t0) * 1000),
        )
    except Exception as exc:
        return ComponentHealth(status="down", detail=str(exc))


async def check_celery() -> ComponentHealth:
    """Lightweight Celery check.

    Public cloud mode runs scrapes through the API/GitHub cron path, so a
    Celery worker is optional. Do not mark health degraded when the broker is
    unset or still points at local development Redis.
    """
    try:
        from jam.config import settings
        broker = settings.celery_broker_url
        if settings.scrape_trigger_token or not broker or "localhost" in broker or "127.0.0.1" in broker:
            return ComponentHealth(status="ok", detail="disabled in cloud scrape mode")

        from jam.tasks.celery_app import app
        # inspect().ping() is expensive; instead just verify broker connection
        conn = app.connection_for_read()
        conn.ensure_connection(max_retries=1, timeout=3)
        conn.release()
        return ComponentHealth(status="ok")
    except Exception as exc:
        return ComponentHealth(status="degraded", detail=str(exc))


async def get_last_scrape_run() -> Optional[str]:
    try:
        from jam.database import db_session
        from jam.models import ScrapeRun
        from sqlalchemy import select

        async with db_session() as session:
            result = await session.execute(
                select(ScrapeRun.started_at)
                .where(ScrapeRun.status == "success")
                .order_by(ScrapeRun.started_at.desc())
                .limit(1)
            )
            row = result.first()
            return row[0].isoformat() if row else None
    except Exception:
        return None
