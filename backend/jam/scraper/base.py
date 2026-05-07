"""
BaseScraper ABC — all ATS-specific scrapers inherit from this.

The base class handles:
  - Rate limiting (via RateLimiterPool)
  - Error classification and retry
  - Scrape run logging to DB
  - Structured logging of every outcome

Subclasses only need to implement:
  - build_url(slug) → str
  - parse_response(data, slug) → list[RawJob]
  - (optional) requires_browser = True  →  use Scrapling instead of aiohttp
"""
from __future__ import annotations

import asyncio
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Optional

import aiohttp
import structlog

from jam.scraper.error_taxonomy import (
    ErrorKind,
    classify_exception,
    classify_http,
    retry_policy,
)
from jam.scraper.rate_limiter import rate_limiter_pool

logger = structlog.get_logger(__name__)


# ── Raw job data out of the scraper ──────────────────────────────────────────

@dataclass
class RawJob:
    """Normalized job data as returned by a scraper, before DB insertion."""
    external_id: str
    title: str
    url: str
    company_slug: str
    company_name: str
    ats: str

    location: Optional[str] = None
    remote: Optional[bool] = None
    description_raw: Optional[str] = None
    posted_at: Optional[datetime] = None
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None

    # Populated by enrichment pipeline, not by scraper
    yoe_min: Optional[int] = None
    yoe_max: Optional[int] = None
    yoe_source: Optional[str] = None


# ── Scrape result ─────────────────────────────────────────────────────────────

@dataclass
class ScrapeResult:
    slug: str
    ats: str
    status: str                       # ok|ok_empty|http_404|http_429|...
    jobs: list[RawJob] = field(default_factory=list)
    error_kind: Optional[ErrorKind] = None
    error_detail: Optional[str] = None
    http_status: Optional[int] = None
    duration_ms: Optional[int] = None
    run_id: Optional[int] = None      # scrape_runs.id after DB logging


# ── Base scraper ──────────────────────────────────────────────────────────────

class BaseScraper(ABC):
    """
    Abstract base for all ATS scrapers.

    Lifecycle per slug:
      1. acquire rate limit token
      2. fetch (with retries per error taxonomy)
      3. parse response into list[RawJob]
      4. log result to scrape_runs
      5. return ScrapeResult
    """

    ats: str = ""           # must be set by subclass (e.g. "greenhouse")
    requires_browser: bool = False  # True → use Scrapling, not aiohttp

    def __init__(self, session: aiohttp.ClientSession):
        self._session = session
        self._limiter = rate_limiter_pool.get(self.ats)

    @abstractmethod
    def build_url(self, slug: str) -> str:
        """Construct the full URL for a given company slug."""
        ...

    @abstractmethod
    def parse_response(self, data: Any, slug: str) -> list[RawJob]:
        """
        Parse raw API response into a list of RawJob.
        Raise ValueError on unexpected structure (→ PARSE_ERROR).
        """
        ...

    async def fetch(self, slug: str) -> tuple[Any, ErrorKind, int]:
        """
        Fetch and decode the response for one slug.
        Returns: (parsed_data_or_None, error_kind, http_status)
        """
        url = self.build_url(slug)
        t_start = time.monotonic()

        async with self._limiter:
            try:
                resp = await self._session.get(url)
            except Exception as exc:
                kind = classify_exception(exc)
                logger.warning(
                    "scrape_fetch_exception",
                    ats=self.ats,
                    slug=slug,
                    url=url,
                    kind=kind,
                    exc=str(exc),
                )
                return None, kind, 0

            status = resp.status
            kind = classify_http(status)

            # Proactive backoff on low remaining quota
            remaining = int(resp.headers.get("X-RateLimit-Remaining", "999"))
            if remaining < 5:
                await asyncio.sleep(2.0)

            if kind != ErrorKind.OK:
                logger.warning(
                    "scrape_http_error",
                    ats=self.ats,
                    slug=slug,
                    status=status,
                    kind=kind,
                )
                return None, kind, status

            try:
                data = await resp.json(content_type=None)
            except Exception as exc:
                logger.error(
                    "scrape_json_decode_error",
                    ats=self.ats,
                    slug=slug,
                    exc=str(exc),
                )
                return None, ErrorKind.PARSE_ERROR, status

        latency_ms = int((time.monotonic() - t_start) * 1000)
        return data, ErrorKind.OK, status

    async def scrape(self, slug: str) -> ScrapeResult:
        """
        Full scrape lifecycle for one slug: fetch → retry → parse → return.
        """
        t_start = time.monotonic()
        policy = retry_policy(ErrorKind.NETWORK_ERROR)  # default — overridden below
        last_kind = ErrorKind.NETWORK_ERROR
        last_http = 0
        data = None

        for attempt in range(4):  # 0, 1, 2, 3
            data, last_kind, last_http = await self.fetch(slug)

            if last_kind == ErrorKind.OK:
                break

            policy = retry_policy(last_kind)
            if not policy.should_retry or attempt >= policy.max_attempts:
                break

            delay = policy.base_delay_s * (policy.backoff_factor ** attempt)
            logger.info(
                "scrape_retry",
                ats=self.ats,
                slug=slug,
                attempt=attempt + 1,
                delay_s=delay,
                kind=last_kind,
            )
            await asyncio.sleep(delay)

        duration_ms = int((time.monotonic() - t_start) * 1000)

        # Dead slug
        if last_kind == ErrorKind.DEAD:
            logger.info("scrape_dead_slug", ats=self.ats, slug=slug)
            return ScrapeResult(
                slug=slug, ats=self.ats, status="http_404",
                error_kind=last_kind, http_status=last_http, duration_ms=duration_ms,
            )

        # Failed (non-dead)
        if last_kind != ErrorKind.OK or data is None:
            return ScrapeResult(
                slug=slug, ats=self.ats, status=last_kind.value,
                error_kind=last_kind, http_status=last_http, duration_ms=duration_ms,
            )

        # Parse
        try:
            jobs = self.parse_response(data, slug)
        except Exception as exc:
            logger.error(
                "scrape_parse_error",
                ats=self.ats,
                slug=slug,
                exc=str(exc),
            )
            return ScrapeResult(
                slug=slug, ats=self.ats, status="parse_error",
                error_kind=ErrorKind.PARSE_ERROR,
                error_detail=str(exc),
                http_status=last_http,
                duration_ms=duration_ms,
            )

        if not jobs:
            logger.info("scrape_ok_empty", ats=self.ats, slug=slug)
            return ScrapeResult(
                slug=slug, ats=self.ats, status="ok_empty",
                jobs=[], duration_ms=duration_ms,
            )

        logger.info(
            "scrape_ok",
            ats=self.ats,
            slug=slug,
            jobs_count=len(jobs),
            duration_ms=duration_ms,
        )
        return ScrapeResult(
            slug=slug, ats=self.ats, status="ok",
            jobs=jobs, http_status=last_http, duration_ms=duration_ms,
        )
