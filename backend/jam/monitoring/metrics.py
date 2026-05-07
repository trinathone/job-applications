"""
Prometheus metrics — all counters/gauges defined here.

Import these from other modules to increment them:
    from jam.monitoring.metrics import SCRAPE_JOBS_TOTAL
    SCRAPE_JOBS_TOTAL.labels(ats="greenhouse", status="new").inc()

Metrics exported at GET /metrics (Prometheus text format).
"""
from __future__ import annotations

from prometheus_client import Counter, Gauge, Histogram

# ── Scraper ───────────────────────────────────────────────────────────────────

SCRAPE_JOBS_TOTAL = Counter(
    "jam_scrape_jobs_total",
    "Total jobs processed by the scraper pipeline",
    labelnames=["ats", "status"],  # status: new|updated|duplicate|dead
)

SCRAPE_ERRORS_TOTAL = Counter(
    "jam_scrape_errors_total",
    "Total scrape errors by ATS and error kind",
    labelnames=["ats", "error_kind"],  # error_kind: http_404|http_429|http_5xx|timeout|parse|network
)

SCRAPE_DURATION_SECONDS = Histogram(
    "jam_scrape_duration_seconds",
    "Time spent scraping one company slug",
    labelnames=["ats"],
    buckets=[0.1, 0.5, 1.0, 2.0, 5.0, 10.0, 30.0],
)

SCRAPE_SLUGS_ACTIVE = Gauge(
    "jam_scrape_slugs_active",
    "Number of currently active (non-dormant) company slugs",
    labelnames=["ats"],
)

# ── Claude / LLM ─────────────────────────────────────────────────────────────

CLAUDE_SPEND_DAILY = Gauge(
    "jam_claude_spend_daily_usd",
    "Accumulated Claude API spend today in USD",
)

CLAUDE_BUDGET_REMAINING = Gauge(
    "jam_claude_budget_remaining_usd",
    "Remaining Claude API budget for today in USD",
)

CLAUDE_EXTRACTIONS_TOTAL = Counter(
    "jam_claude_extractions_total",
    "Total LLM extraction calls",
    labelnames=["method", "result"],  # method: regex|llm, result: success|miss|budget_exceeded
)

# ── API / Dashboard ───────────────────────────────────────────────────────────

DASHBOARD_PAGE_LOADS = Counter(
    "jam_dashboard_page_loads_total",
    "Total dashboard page load events",
)

API_REQUEST_DURATION = Histogram(
    "jam_api_request_duration_seconds",
    "FastAPI request duration",
    labelnames=["method", "path", "status"],
    buckets=[0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)

SSE_CONNECTIONS_ACTIVE = Gauge(
    "jam_sse_connections_active",
    "Number of currently active SSE connections",
)

# ── Applications ──────────────────────────────────────────────────────────────

APPLICATIONS_TOTAL = Counter(
    "jam_applications_total",
    "Total application actions taken",
    labelnames=["status"],  # applied|skipped|saved
)
