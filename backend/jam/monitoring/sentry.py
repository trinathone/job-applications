"""Sentry initialization — called once at app startup."""
from __future__ import annotations

import structlog

from jam.config import settings

logger = structlog.get_logger(__name__)


def init_sentry() -> None:
    if not settings.sentry_enabled:
        logger.info("sentry_disabled", reason="no_dsn")
        return

    import sentry_sdk
    from sentry_sdk.integrations.celery import CeleryIntegration
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.environment,
        integrations=[
            FastApiIntegration(transaction_style="endpoint"),
            CeleryIntegration(monitor_beat_tasks=True),
            SqlalchemyIntegration(),
        ],
        traces_sample_rate=0.1 if settings.is_production else 1.0,
        profiles_sample_rate=0.05 if settings.is_production else 0.0,
        # Custom fingerprinting: group scrape errors by ATS, not by exception message
        before_send=_before_send,
    )
    logger.info("sentry_initialized", environment=settings.environment)


def _before_send(event, hint):
    """Custom fingerprinting for better Sentry grouping."""
    if "exception" in event:
        exc_values = event["exception"].get("values", [])
        for exc in exc_values:
            # Group all RateLimitErrors together
            if "RateLimit" in (exc.get("type") or ""):
                event["fingerprint"] = ["rate-limit-error"]
            # Group parse errors by ATS
            elif "ParseError" in (exc.get("type") or "") or "parse_error" in str(event.get("message", "")):
                event["fingerprint"] = ["parse-error", event.get("tags", {}).get("ats", "unknown")]
    return event
