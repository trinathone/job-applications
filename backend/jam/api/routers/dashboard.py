"""
Dashboard API:
  GET  /api/dashboard/stream   — SSE stream of real-time job feed events
  GET  /api/dashboard/insights — today's stats snapshot (requires auth)
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import date, datetime, timezone
from typing import AsyncGenerator

import redis.asyncio as aioredis
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from jam.api.deps import get_current_user, get_db, get_redis
from jam.models import User
from jam.monitoring.metrics import SSE_CONNECTIONS_ACTIVE
from jam.schemas import DashboardInsights

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


async def _sse_generator(
    redis_client: aioredis.Redis,
    request: Request,
) -> AsyncGenerator[str, None]:
    SSE_CONNECTIONS_ACTIVE.inc()
    pubsub = redis_client.pubsub()
    try:
        await pubsub.subscribe("jam:feed")
        yield f"event: connected\ndata: {json.dumps({'ts': datetime.now(tz=timezone.utc).isoformat()})}\n\n"
        last_heartbeat = time.monotonic()
        while True:
            if await request.is_disconnected():
                break
            if time.monotonic() - last_heartbeat > 30:
                yield f"event: heartbeat\ndata: {json.dumps({'ts': datetime.now(tz=timezone.utc).isoformat()})}\n\n"
                last_heartbeat = time.monotonic()
            try:
                message = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0),
                    timeout=2.0,
                )
            except asyncio.TimeoutError:
                continue
            if message and message.get("type") == "message":
                data = message.get("data", "{}")
                event_type = "job_update"
                try:
                    parsed = json.loads(data)
                    event_type = parsed.get("event", "job_update")
                except json.JSONDecodeError:
                    pass
                yield f"event: {event_type}\ndata: {data}\n\n"
    finally:
        await pubsub.unsubscribe("jam:feed")
        await pubsub.aclose()
        SSE_CONNECTIONS_ACTIVE.dec()


@router.get("/stream")
async def dashboard_stream(
    request: Request,
    redis: aioredis.Redis = Depends(get_redis),
) -> StreamingResponse:
    return StreamingResponse(
        _sse_generator(redis, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


@router.get("/insights", response_model=DashboardInsights)
async def get_insights(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DashboardInsights:
    today = date.today()
    uid = current_user.id

    new_jobs_today = (await db.execute(
        text("SELECT COUNT(*) FROM jobs WHERE DATE(scraped_at) = :today AND is_dead = false"),
        {"today": today},
    )).scalar() or 0

    applied_today = (await db.execute(
        text("SELECT COUNT(*) FROM applications WHERE user_id = :uid AND session_date = :today AND status = 'applied'"),
        {"uid": uid, "today": today},
    )).scalar() or 0

    streak_result = await db.execute(
        text("""
            WITH dates AS (
                SELECT DISTINCT session_date FROM applications
                WHERE user_id = :uid AND status = 'applied'
                ORDER BY session_date DESC
            )
            SELECT COUNT(*) AS streak FROM (
                SELECT session_date,
                       (session_date - (ROW_NUMBER() OVER (ORDER BY session_date DESC) || ' days')::interval)::date AS grp
                FROM dates
            ) t
            WHERE grp = (
                SELECT (CURRENT_DATE - (ROW_NUMBER() OVER (ORDER BY session_date DESC) || ' days')::interval)::date
                FROM dates LIMIT 1
            )
        """),
        {"uid": uid},
    )
    streak_row = streak_result.first()
    apply_streak = streak_row[0] if streak_row else 0

    top_ats = {row.ats: row.cnt for row in (await db.execute(
        text("SELECT ats, COUNT(*) AS cnt FROM jobs WHERE DATE(scraped_at) = :today AND is_dead = false GROUP BY ats ORDER BY cnt DESC LIMIT 10"),
        {"today": today},
    )).all()}

    top_companies = [row.name for row in (await db.execute(
        text("""
            SELECT c.name, COUNT(*) AS cnt FROM jobs j
            JOIN companies c ON j.company_id = c.id
            WHERE DATE(j.scraped_at) = :today AND j.is_dead = false
            GROUP BY c.name ORDER BY cnt DESC LIMIT 5
        """),
        {"today": today},
    )).all()]

    top_skills = [row.word for row in (await db.execute(
        text("""
            SELECT word, COUNT(*) AS cnt
            FROM (SELECT regexp_split_to_table(title_normalized, ' ') AS word
                  FROM jobs WHERE DATE(scraped_at) = :today AND is_dead = false) t
            WHERE length(word) > 3
            GROUP BY word ORDER BY cnt DESC LIMIT 8
        """),
        {"today": today},
    )).all()]

    scrape_healthy = ((await db.execute(
        text("SELECT COUNT(*) FROM scrape_runs WHERE DATE(started_at) = :today AND status = 'success'"),
        {"today": today},
    )).scalar() or 0) > 0

    return DashboardInsights(
        new_jobs_today=new_jobs_today,
        applied_today=applied_today,
        apply_streak_days=apply_streak,
        top_ats_sources=top_ats,
        top_companies=top_companies,
        top_skills=top_skills,
        claude_spend_today=0.0,
        scrape_healthy=scrape_healthy,
    )
