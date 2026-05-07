"""
Error taxonomy for ATS scraping.

Every HTTP error or exception is classified into an ErrorKind.
The retry policy is determined solely by ErrorKind — no ad-hoc logic elsewhere.

Design contract:
  - 404        → DEAD          → mark company inactive, no retry, alert
  - 429        → RATE_LIMITED  → exponential backoff, do NOT increment fail streak
  - 5xx        → SERVER_ERROR  → retry 3x, increment fail streak on final failure
  - timeout    → TIMEOUT       → skip this run, do NOT increment fail streak
  - parse fail → PARSE_ERROR   → retry 1x, then alert (ATS schema changed)
  - network    → NETWORK_ERROR → treat like timeout
  - ok_empty   → OK_EMPTY      → update last_active, do NOT mark dead
"""
from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Optional


class ErrorKind(str, Enum):
    DEAD = "http_404"            # confirmed gone
    RATE_LIMITED = "http_429"    # back off, do not fail-count
    SERVER_ERROR = "http_5xx"    # temporary server problem
    TIMEOUT = "timeout"          # connection/read timeout
    NETWORK_ERROR = "network"    # DNS, connection refused, etc.
    PARSE_ERROR = "parse"        # unexpected JSON shape
    OK_EMPTY = "ok_empty"        # 200 but zero jobs listed
    OK = "ok"                    # success


@dataclass(frozen=True)
class RetryConfig:
    should_retry: bool
    max_attempts: int
    base_delay_s: float           # first retry delay
    backoff_factor: float         # multiply delay each attempt
    count_as_failure: bool        # whether to increment fail_streak


# Per-ErrorKind retry policies
_RETRY_POLICIES: dict[ErrorKind, RetryConfig] = {
    ErrorKind.DEAD: RetryConfig(
        should_retry=False, max_attempts=0, base_delay_s=0, backoff_factor=1,
        count_as_failure=True,
    ),
    ErrorKind.RATE_LIMITED: RetryConfig(
        should_retry=True, max_attempts=3, base_delay_s=1.0, backoff_factor=2.0,
        count_as_failure=False,  # 429 is not a slug quality issue
    ),
    ErrorKind.SERVER_ERROR: RetryConfig(
        should_retry=True, max_attempts=3, base_delay_s=5.0, backoff_factor=3.0,
        count_as_failure=True,
    ),
    ErrorKind.TIMEOUT: RetryConfig(
        should_retry=False, max_attempts=0, base_delay_s=0, backoff_factor=1,
        count_as_failure=False,  # transient infra issue
    ),
    ErrorKind.NETWORK_ERROR: RetryConfig(
        should_retry=False, max_attempts=0, base_delay_s=0, backoff_factor=1,
        count_as_failure=False,
    ),
    ErrorKind.PARSE_ERROR: RetryConfig(
        should_retry=True, max_attempts=1, base_delay_s=2.0, backoff_factor=1,
        count_as_failure=True,   # repeated parse failure → schema changed
    ),
    ErrorKind.OK_EMPTY: RetryConfig(
        should_retry=False, max_attempts=0, base_delay_s=0, backoff_factor=1,
        count_as_failure=False,
    ),
    ErrorKind.OK: RetryConfig(
        should_retry=False, max_attempts=0, base_delay_s=0, backoff_factor=1,
        count_as_failure=False,
    ),
}


def classify_http(status_code: int) -> ErrorKind:
    """Map an HTTP status code to an ErrorKind."""
    if status_code == 200:
        return ErrorKind.OK
    if status_code == 404:
        return ErrorKind.DEAD
    if status_code == 429:
        return ErrorKind.RATE_LIMITED
    if 500 <= status_code < 600:
        return ErrorKind.SERVER_ERROR
    # 301/302 chains should be followed by aiohttp; if we get here it's unexpected
    return ErrorKind.SERVER_ERROR


def classify_exception(exc: Exception) -> ErrorKind:
    """Map a caught exception to an ErrorKind."""
    import aiohttp

    if isinstance(exc, asyncio.TimeoutError):
        return ErrorKind.TIMEOUT
    if isinstance(exc, aiohttp.ServerTimeoutError):
        return ErrorKind.TIMEOUT
    if isinstance(exc, (aiohttp.ClientConnectionError, aiohttp.ClientConnectorError)):
        return ErrorKind.NETWORK_ERROR
    if isinstance(exc, aiohttp.ClientError):
        return ErrorKind.NETWORK_ERROR
    if isinstance(exc, (ValueError, KeyError, TypeError)):
        return ErrorKind.PARSE_ERROR
    return ErrorKind.NETWORK_ERROR


def retry_policy(kind: ErrorKind) -> RetryConfig:
    return _RETRY_POLICIES[kind]


async def execute_with_retry(coro_fn, *, kind_override: Optional[ErrorKind] = None):
    """
    Execute an async coroutine with per-ErrorKind retry logic.

    coro_fn: zero-argument async callable returning (result, ErrorKind)
    Returns: result from coro_fn on success, or raises on exhaustion.

    Usage:
        result, kind = await execute_with_retry(lambda: fetch_jobs(slug))
    """
    last_kind = kind_override or ErrorKind.NETWORK_ERROR
    last_exc: Optional[Exception] = None
    attempt = 0

    while True:
        try:
            result, kind = await coro_fn()
            return result, kind
        except Exception as exc:
            last_exc = exc
            last_kind = classify_exception(exc)

        policy = _RETRY_POLICIES[last_kind]
        if not policy.should_retry or attempt >= policy.max_attempts:
            break

        delay = policy.base_delay_s * (policy.backoff_factor ** attempt)
        await asyncio.sleep(delay)
        attempt += 1

    if last_exc:
        raise last_exc
    return None, last_kind
