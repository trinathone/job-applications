"""
TheirStack job search API.

POST https://api.theirstack.com/v1/jobs/search
Returns aggregated job listings from LinkedIn, Indeed, and company career pages.
USA-only, US tech roles.
"""
from __future__ import annotations

import asyncio
from datetime import datetime
from typing import Any

import aiohttp
import structlog

from jam.config import settings
from jam.scraper.base import RawJob

logger = structlog.get_logger(__name__)

THEIRSTACK_BASE = "https://api.theirstack.com/v1"

JOB_TITLES = [
    "software engineer",
    "backend engineer",
    "frontend engineer",
    "full stack engineer",
    "machine learning engineer",
    "data engineer",
    "platform engineer",
    "site reliability engineer",
    "devops engineer",
]


def _parse_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw)
    except (ValueError, AttributeError):
        return None


def _normalize(item: dict[str, Any]) -> RawJob | None:
    try:
        job_id = str(item["id"])
        title = item.get("job_title") or ""
        company = item.get("company") or "Unknown"
        url = item.get("source_url") or item.get("url") or item.get("final_url") or ""
        location = item.get("long_location") or item.get("short_location") or item.get("location") or ""
        remote = item.get("remote", False)
        salary_min = item.get("min_annual_salary_usd") or item.get("min_annual_salary")
        salary_max = item.get("max_annual_salary_usd") or item.get("max_annual_salary")
        posted_at = _parse_date(item.get("discovered_at") or item.get("date_posted"))

        company_slug = company.lower().replace(" ", "-").replace(".", "")[:80]

        # Convert salary to int if float
        if salary_min is not None:
            salary_min = int(salary_min)
        if salary_max is not None:
            salary_max = int(salary_max)

        return RawJob(
            external_id=f"ts_{job_id}",
            title=title,
            url=url,
            company_slug=company_slug,
            company_name=company,
            ats="theirstack",
            location=location,
            remote=bool(remote),
            description_raw=None,  # TheirStack doesn't return full JD in search
            posted_at=posted_at,
            salary_min=salary_min,
            salary_max=salary_max,
        )
    except Exception as exc:
        logger.warning("theirstack_normalize_error", exc=str(exc))
        return None


async def _fetch_batch(
    session: aiohttp.ClientSession,
    titles: list[str],
    page: int = 0,
    limit: int = 50,
) -> list[dict]:
    try:
        resp = await session.post(
            f"{THEIRSTACK_BASE}/jobs/search",
            headers={
                "Authorization": f"Bearer {settings.theirstack_api_key}",
                "Content-Type": "application/json",
            },
            json={
                "page": page,
                "limit": limit,
                "job_title_or": titles,
                "posted_at_max_age_days": 7,
            },
            timeout=aiohttp.ClientTimeout(total=30),
        )
        if resp.status != 200:
            logger.warning("theirstack_http_error", status=resp.status)
            return []
        data = await resp.json(content_type=None)
        return data.get("data", [])
    except Exception as exc:
        logger.error("theirstack_exception", exc=str(exc))
        return []


async def fetch_theirstack(session: aiohttp.ClientSession) -> list[RawJob]:
    if not settings.theirstack_api_key:
        logger.debug("theirstack_skipped", reason="no_key")
        return []

    results: list[RawJob] = []
    seen_ids: set[str] = set()

    # Batch titles in groups of 5 to reduce API calls while covering all roles
    title_batches = [JOB_TITLES[i:i+5] for i in range(0, len(JOB_TITLES), 5)]

    for batch in title_batches:
        for page in range(2):
            items = await _fetch_batch(session, batch, page=page, limit=10)
            if not items:
                break
            for item in items:
                job = _normalize(item)
                if job and job.external_id not in seen_ids:
                    seen_ids.add(job.external_id)
                    results.append(job)
            if len(items) < 50:
                break
            await asyncio.sleep(0.5)

    logger.info("theirstack_total", count=len(results))
    return results
