"""
Celery application — single source of truth for broker config and task routing.

Key safety settings:
  acks_late=True         — task is only ACK'd after completion; re-queued on worker crash
  reject_on_worker_lost  — re-queue if worker dies mid-task (requires acks_late)
  task_track_started     — enable STARTED state for monitoring
  result_expires         — clean up old results automatically

Queue routing:
  scrape  — all scraping tasks (I/O-bound, high concurrency)
  enrich  — Claude API calls (rate-limited)
  default — everything else
"""
from __future__ import annotations

from celery import Celery
from kombu import Exchange, Queue

from jam.config import settings

app = Celery("jam")

app.config_from_object(
    {
        # Broker + backend
        "broker_url": settings.celery_broker_url,
        "result_backend": settings.celery_result_backend,
        "result_expires": 60 * 60 * 24 * 7,  # 7 days

        # Serialization
        "task_serializer": "json",
        "result_serializer": "json",
        "accept_content": ["json"],
        "timezone": "UTC",
        "enable_utc": True,

        # Reliability
        "task_acks_late": True,
        "task_reject_on_worker_lost": True,
        "task_track_started": True,
        "worker_prefetch_multiplier": 1,  # don't prefetch more than 1 task per worker slot

        # Routing
        "task_default_queue": "default",
        "task_queues": [
            Queue("default",  Exchange("default"),  routing_key="default"),
            Queue("scrape",   Exchange("scrape"),   routing_key="scrape"),
            Queue("enrich",   Exchange("enrich"),   routing_key="enrich"),
            Queue("notify",   Exchange("notify"),   routing_key="notify"),
        ],
        "task_routes": {
            "jam.tasks.scrape_tasks.*":         {"queue": "scrape"},
            "jam.tasks.enrich_tasks.*":         {"queue": "enrich"},
            "jam.tasks.notify_tasks.*":         {"queue": "notify"},
            "jam.tasks.health_tasks.*":         {"queue": "default"},
            "jam.tasks.weekly_review_tasks.*":  {"queue": "default"},
        },

        # Beat scheduler (redbeat for distributed locking)
        "beat_scheduler": "redbeat.RedBeatScheduler",
        "redbeat_redis_url": settings.celery_broker_url,
        "redbeat_lock_timeout": 5 * 60,  # 5 min — prevent split-brain beat

        # Sentry integration
        **({"sentry_dsn": settings.sentry_dsn} if settings.sentry_enabled else {}),
    }
)

# Auto-discover tasks
app.autodiscover_tasks(
    [
        "jam.tasks.scrape_tasks",
        "jam.tasks.enrich_tasks",
        "jam.tasks.health_tasks",
        "jam.tasks.notify_tasks",
        "jam.tasks.weekly_review_tasks",
    ]
)
