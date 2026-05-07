"""
Celery Beat schedule — all recurring tasks.
All times UTC. User timezone is IST (UTC+5:30).

Scrape windows (3 per day only — respects API rate limits):
  07:00 IST = 01:30 UTC
  11:00 IST = 05:30 UTC
  16:00 IST = 10:30 UTC

Support tasks:
  Every hour at :45  — YOE enrichment (regex only, fast)
  03:00 UTC daily    — delete jobs older than 7 days (keep applied forever)
  03:30 UTC Sunday   — prune dormant company slugs
"""
from __future__ import annotations

from celery.schedules import crontab

from jam.tasks.celery_app import app

app.conf.beat_schedule = {
    # ── Scrape: 07:00 IST (01:30 UTC) ────────────────────────────────────────
    "scrape-morning": {
        "task": "jam.tasks.scrape_tasks.run_morning_scrape",
        "schedule": crontab(hour=1, minute=30),
        "options": {"queue": "scrape"},
    },

    # ── Scrape: 11:00 IST (05:30 UTC) ────────────────────────────────────────
    "scrape-midday": {
        "task": "jam.tasks.scrape_tasks.run_morning_scrape",
        "schedule": crontab(hour=5, minute=30),
        "options": {"queue": "scrape"},
    },

    # ── Scrape: 16:00 IST (10:30 UTC) ────────────────────────────────────────
    "scrape-afternoon": {
        "task": "jam.tasks.scrape_tasks.run_morning_scrape",
        "schedule": crontab(hour=10, minute=30),
        "options": {"queue": "scrape"},
    },

    # ── YOE enrichment — every hour at :45 ───────────────────────────────────
    "enrich-pending": {
        "task": "jam.tasks.enrich_tasks.enrich_pending_jobs",
        "schedule": crontab(minute=45),
        "options": {"queue": "enrich"},
    },

    # ── Daily cleanup: 7-day retention, keep applied jobs forever ─────────────
    "daily-cleanup": {
        "task": "jam.tasks.cleanup_tasks.cleanup_old_jobs",
        "schedule": crontab(hour=3, minute=0),
        "options": {"queue": "default"},
    },

    # ── Weekly slug pruning: Sunday 03:30 UTC ─────────────────────────────────
    "prune-dormant-slugs": {
        "task": "jam.tasks.health_tasks.prune_dormant_slugs",
        "schedule": crontab(day_of_week=0, hour=3, minute=30),
        "options": {"queue": "default"},
    },
}
