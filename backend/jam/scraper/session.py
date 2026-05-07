"""
aiohttp ClientSession factory with shared defaults.

One session per scrape run (not per request). The session is created in the
Celery task, passed down to all scrapers, and closed when the task finishes.

User-agent rotation: rotate through a small pool to reduce fingerprinting.
Timeouts are set conservatively — ATS boards are generally fast.
"""
from __future__ import annotations

import itertools
import ssl
from typing import Optional

import aiohttp
import certifi

from jam.config import settings

_USER_AGENTS = itertools.cycle([
    "Mozilla/5.0 (compatible; JAMBot/1.0; +https://github.com/jam-project)",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0",
])

_DEFAULT_HEADERS = {
    "Accept": "application/json, text/html, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Cache-Control": "no-cache",
}

_TIMEOUT = aiohttp.ClientTimeout(
    total=settings.scraper_request_timeout,
    connect=5,
    sock_connect=5,
    sock_read=settings.scraper_request_timeout - 2,
)


def create_ssl_context() -> ssl.SSLContext:
    """Use certifi CA bundle — avoids issues with system certs on macOS."""
    ctx = ssl.create_default_context(cafile=certifi.where())
    return ctx


def create_session(
    *,
    extra_headers: Optional[dict] = None,
    timeout: Optional[aiohttp.ClientTimeout] = None,
) -> aiohttp.ClientSession:
    """
    Create a configured aiohttp session.

    Call once per scrape run, share across all concurrent requests, close after.

    Example usage in a Celery task:
        async def run():
            async with create_session() as session:
                results = await gather_all_scrapes(session)
    """
    headers = {**_DEFAULT_HEADERS, "User-Agent": next(_USER_AGENTS)}
    if extra_headers:
        headers.update(extra_headers)

    connector = aiohttp.TCPConnector(
        ssl=create_ssl_context(),
        limit=settings.scraper_max_concurrent + 20,  # headroom
        limit_per_host=10,       # max concurrent to same hostname
        enable_cleanup_closed=True,
        ttl_dns_cache=300,       # 5 min DNS cache
    )

    return aiohttp.ClientSession(
        headers=headers,
        timeout=timeout or _TIMEOUT,
        connector=connector,
        raise_for_status=False,  # we handle status codes ourselves
        json_serialize=__import__("orjson").dumps,  # faster JSON serialization
    )
