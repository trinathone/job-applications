"""
Celery Beat schedule — all recurring tasks.
Times are UTC.

Schedule:
  06:30 UTC daily    — scrape pipeline (morning)
  13:00 UTC daily    — scrape pipeline (midday)
  Every hour         — enrich new jobs (regex YOE extraction)
  03:00 UTC daily    — cleanup jobs older than 7 days (keep applied ones)
  03:30 UTC Sunday   — prune dormant company slugs
"""
from __future__ import annotations

from celery.schedules import crontab

from jam.tasks.celery_app import app

app.conf.beat_schedule = {
    # ── Scrape pipeline ───────────────────────────────────────────────────────
    "morning-scrape": {
        "task": "jam.tasks.scrape_tasks.run_morning_scrape",
        "schedule": crontab(hour=6, minute=30),
        "options": {"queue": "scrape"},
    },
    "midday-scrape": {
        "task": "jam.tasks.scrape_tasks.run_morning_scrape",
        "schedule": crontab(hour=13, minute=0),
        "options": {"queue": "scrape"},
    },

    # ── YOE enrichment (regex only) ───────────────────────────────────────────
    "enrich-pending": {
        "task": "jam.tasks.enrich_tasks.enrich_pending_jobs",
        "schedule": crontab(minute=30),   # every hour at :30
        "options": {"queue": "enrich"},
    },

    # ── Daily cleanup: delete jobs older than 7 days (except applied) ─────────
    "daily-cleanup": {
        "task": "jam.tasks.cleanup_tasks.cleanup_old_jobs",
        "schedule": crontab(hour=3, minute=0),
        "options": {"queue": "default"},
    },

    # ── Slug maintenance ──────────────────────────────────────────────────────
    "prune-dormant-slugs": {
        "task": "jam.tasks.health_tasks.prune_dormant_slugs",
        "schedule": crontab(day_of_week=0, hour=3, minute=30),
        "options": {"queue": "default"},
    },
}
