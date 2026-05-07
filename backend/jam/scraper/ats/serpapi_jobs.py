"""
Google Jobs via SerpAPI.

Endpoint: https://serpapi.com/search.json?engine=google_jobs
Free tier: 100 searches/month. We fan out across job titles.
Each call returns up to 10 results; we page with `start` param.
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any

import aiohttp
import structlog

from jam.config import settings
from jam.scraper.base import RawJob

logger = structlog.get_logger(__name__)

SERPAPI_BASE = "https://serpapi.com/search.json"

SEARCHES = [
    "software engineer",
    "backend engineer",
    "frontend engineer",
    "full stack developer",
    "machine learning engineer",
    "data engineer",
    "platform engineer",
    "devops engineer",
]


def _parse_ts(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _normalize(item: dict[str, Any], query: str) -> RawJob | None:
    try:
        job_id = item.get("job_id") or item.get("id") or ""
        title = item.get("title") or query
        company = item.get("company_name") or "Unknown"
        description = item.get("description") or None

        # Location
        location = item.get("location") or None

        # Apply link — prefer direct link over serpapi redirect
        related = item.get("related_links", [])
        apply_link = item.get("job_highlights_apply_link") or (related[0]["link"] if related else "")
        if not apply_link:
            apply_link = f"https://www.google.com/search?q={title.replace(' ', '+')}+{company.replace(' ', '+')}"

        # Remote
        extensions = item.get("detected_extensions", {})
        remote = extensions.get("work_from_home", False)

        # Salary
        salary_str = extensions.get("salary") or ""
        salary_min = salary_max = None
        if salary_str:
            import re
            nums = re.findall(r"[\d,]+", salary_str)
            nums = [int(n.replace(",", "")) for n in nums if len(n.replace(",", "")) > 3]
            if len(nums) >= 2:
                salary_min, salary_max = nums[0], nums[1]
            elif nums:
                salary_min = nums[0]

        # Posted at
        posted_raw = extensions.get("posted_at")
        posted_at: datetime | None = None
        if posted_raw:
            # SerpAPI returns relative strings like "3 days ago"
            import re as _re
            now = datetime.now(tz=timezone.utc)
            m = _re.match(r"(\d+)\s+(hour|day|week|month)", posted_raw)
            if m:
                n, unit = int(m.group(1)), m.group(2)
                from datetime import timedelta
                delta_map = {"hour": timedelta(hours=n), "day": timedelta(days=n),
                             "week": timedelta(weeks=n), "month": timedelta(days=n * 30)}
                posted_at = now - delta_map.get(unit, timedelta(0))

        company_slug = company.lower().replace(" ", "-").replace(".", "")[:80]
        # job_id from Google can be very long (base64 blob) — hash it to keep under 300 chars
        import hashlib
        id_hash = hashlib.sha1(job_id.encode()).hexdigest()[:16] if job_id else ""
        external_id = f"serp_{id_hash}" if id_hash else f"serp_{company_slug}_{title[:30].replace(' ', '_')}"

        return RawJob(
            external_id=external_id,
            title=title,
            url=apply_link,
            company_slug=company_slug,
            company_name=company,
            ats="serpapi",
            location=location,
            remote=bool(remote),
            description_raw=description[:8000] if description else None,
            posted_at=posted_at,
            salary_min=salary_min,
            salary_max=salary_max,
        )
    except Exception as exc:
        logger.warning("serpapi_normalize_error", exc=str(exc))
        return None


async def _search_one(
    session: aiohttp.ClientSession,
    query: str,
    location: str = "United States",
    start: int = 0,
) -> list[dict]:
    try:
        resp = await session.get(
            SERPAPI_BASE,
            params={
                "engine": "google_jobs",
                "q": query,
                "location": location,
                "api_key": settings.serpapi_key,
                "start": start,
                "hl": "en",
            },
            timeout=aiohttp.ClientTimeout(total=20),
        )
        if resp.status != 200:
            logger.warning("serpapi_http_error", status=resp.status, query=query)
            return []
        data = await resp.json(content_type=None)
        return data.get("jobs_results", [])
    except Exception as exc:
        logger.error("serpapi_exception", query=query, exc=str(exc))
        return []


async def fetch_serpapi(session: aiohttp.ClientSession) -> list[RawJob]:
    if not settings.serpapi_key:
        logger.debug("serpapi_skipped", reason="no_key")
        return []

    results: list[RawJob] = []
    seen_ids: set[str] = set()
    sem = asyncio.Semaphore(3)  # don't hammer rate limit

    async def fetch_query(query: str) -> list[RawJob]:
        jobs: list[RawJob] = []
        async with sem:
            items = await _search_one(session, query)
        for item in items:
            job = _normalize(item, query)
            if job and job.external_id not in seen_ids:
                seen_ids.add(job.external_id)
                jobs.append(job)
        logger.info("serpapi_query_done", query=query, count=len(jobs))
        return jobs

    tasks = [asyncio.create_task(fetch_query(q)) for q in SEARCHES]
    for task in asyncio.as_completed(tasks):
        try:
            jobs = await task
            results.extend(jobs)
        except Exception as exc:
            logger.error("serpapi_task_error", exc=str(exc))

    logger.info("serpapi_total", count=len(results))
    return results
