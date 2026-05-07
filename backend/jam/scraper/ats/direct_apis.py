"""
Direct API sources — no company slug iteration required.
These return global job listings from a single endpoint.

Sources:
  - Adzuna API      (global, free with key)
  - Remotive API    (remote-only, free)
  - Jobicy API      (remote-only, free)
  - Working Nomads  (remote-only, free)
  - The Muse API    (US-focused, free with key)
  - Reed.co.uk API  (UK + global, free with key)

Each source implements fetch_jobs() → list[RawJob].
All are called from the pipeline as one-shot fetches (not slug-based).
"""
from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from typing import Any, Optional

import aiohttp
import structlog

from jam.config import settings
from jam.scraper.base import RawJob
from jam.scraper.rate_limiter import rate_limiter_pool

logger = structlog.get_logger(__name__)


def _parse_iso(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


# ── Remotive ──────────────────────────────────────────────────────────────────

async def fetch_remotive(session: aiohttp.ClientSession) -> list[RawJob]:
    """
    https://remotive.com/api/remote-jobs
    Free, no auth. Returns up to 500 jobs per call.
    Optionally filter by category: ?category=software-dev
    """
    limiter = rate_limiter_pool.get("remotive")
    results: list[RawJob] = []

    categories = ["software-dev", "data", "devops-sysadmin", "product"]

    for category in categories:
        async with limiter:
            try:
                resp = await session.get(
                    f"https://remotive.com/api/remote-jobs?category={category}&limit=200"
                )
                if resp.status != 200:
                    logger.warning("remotive_error", status=resp.status, category=category)
                    continue
                data = await resp.json(content_type=None)
            except Exception as exc:
                logger.error("remotive_exception", exc=str(exc))
                continue

        for item in data.get("jobs", []):
            try:
                results.append(RawJob(
                    external_id=str(item["id"]),
                    title=item["title"],
                    url=item["url"],
                    company_slug=item.get("company_name", "unknown").lower().replace(" ", "-"),
                    company_name=item.get("company_name", "Unknown"),
                    ats="remotive",
                    location="Remote",
                    remote=True,
                    description_raw=item.get("description"),
                    posted_at=_parse_iso(item.get("publication_date")),
                    salary_min=item.get("salary", {}).get("min") if item.get("salary") else None,
                    salary_max=item.get("salary", {}).get("max") if item.get("salary") else None,
                ))
            except (KeyError, TypeError):
                continue

    return results


# ── Jobicy ────────────────────────────────────────────────────────────────────

async def fetch_jobicy(session: aiohttp.ClientSession) -> list[RawJob]:
    """
    https://jobicy.com/api/v2/remote-jobs
    Free, no auth. Up to 50 jobs per call, paginated by &count=50&geo=&tag=.
    """
    limiter = rate_limiter_pool.get("jobicy")
    results: list[RawJob] = []

    try:
        async with limiter:
            resp = await session.get(
                "https://jobicy.com/api/v2/remote-jobs?count=50&tag=developer"
            )
            if resp.status != 200:
                return results
            data = await resp.json(content_type=None)
    except Exception as exc:
        logger.error("jobicy_exception", exc=str(exc))
        return results

    for item in data.get("jobs", []):
        try:
            results.append(RawJob(
                external_id=str(item["id"]),
                title=item["jobTitle"],
                url=item["url"],
                company_slug=item.get("companyName", "").lower().replace(" ", "-"),
                company_name=item.get("companyName", "Unknown"),
                ats="jobicy",
                location="Remote",
                remote=True,
                description_raw=item.get("jobDescription"),
                posted_at=_parse_iso(item.get("pubDate")),
            ))
        except (KeyError, TypeError):
            continue

    return results


# ── Working Nomads ────────────────────────────────────────────────────────────

async def fetch_working_nomads(session: aiohttp.ClientSession) -> list[RawJob]:
    """
    https://www.workingnomads.com/api/exposed_jobs/
    Free, no auth. JSON array of remote jobs.
    """
    limiter = rate_limiter_pool.get("working_nomads")
    results: list[RawJob] = []

    try:
        async with limiter:
            resp = await session.get("https://www.workingnomads.com/api/exposed_jobs/")
            if resp.status != 200:
                return results
            jobs = await resp.json(content_type=None)
    except Exception as exc:
        logger.error("working_nomads_exception", exc=str(exc))
        return results

    for item in (jobs if isinstance(jobs, list) else []):
        try:
            results.append(RawJob(
                external_id=str(item["id"]),
                title=item["title"],
                url=item["url"],
                company_slug=item.get("company", "unknown").lower().replace(" ", "-"),
                company_name=item.get("company", "Unknown"),
                ats="working_nomads",
                location="Remote",
                remote=True,
                posted_at=_parse_iso(item.get("pub_date")),
            ))
        except (KeyError, TypeError):
            continue

    return results


# ── Adzuna ────────────────────────────────────────────────────────────────────

async def fetch_adzuna(
    session: aiohttp.ClientSession,
    *,
    country: str = "us",
    what: str = "software engineer",
    results_per_page: int = 50,
    pages: int = 3,
) -> list[RawJob]:
    """
    https://developer.adzuna.com
    Requires ADZUNA_APP_ID + ADZUNA_APP_KEY.
    """
    if not settings.adzuna_app_id or not settings.adzuna_app_key:
        logger.debug("adzuna_skipped", reason="no_credentials")
        return []

    limiter = rate_limiter_pool.get("adzuna")
    results: list[RawJob] = []
    base = f"https://api.adzuna.com/v1/api/jobs/{country}/search"

    for page in range(1, pages + 1):
        async with limiter:
            try:
                resp = await session.get(
                    f"{base}/{page}",
                    params={
                        "app_id": settings.adzuna_app_id,
                        "app_key": settings.adzuna_app_key,
                        "results_per_page": results_per_page,
                        "what": what,
                        "content-type": "application/json",
                    },
                )
                if resp.status != 200:
                    break
                data = await resp.json(content_type=None)
            except Exception as exc:
                logger.error("adzuna_exception", page=page, exc=str(exc))
                break

        for item in data.get("results", []):
            try:
                company = item.get("company", {}).get("display_name", "Unknown")
                results.append(RawJob(
                    external_id=str(item["id"]),
                    title=item["title"],
                    url=item.get("redirect_url", item.get("url", "")),
                    company_slug=company.lower().replace(" ", "-"),
                    company_name=company,
                    ats="adzuna",
                    location=item.get("location", {}).get("display_name"),
                    remote=None,
                    description_raw=item.get("description"),
                    posted_at=_parse_iso(item.get("created")),
                    salary_min=int(item["salary_min"]) if item.get("salary_min") else None,
                    salary_max=int(item["salary_max"]) if item.get("salary_max") else None,
                ))
            except (KeyError, TypeError):
                continue

    return results


# ── The Muse ──────────────────────────────────────────────────────────────────

async def fetch_the_muse(session: aiohttp.ClientSession) -> list[RawJob]:
    """
    https://www.themuse.com/developers/api/v2
    Free with optional API key for higher rate limits.
    """
    limiter = rate_limiter_pool.get("the_muse")
    results: list[RawJob] = []
    params: dict = {"category": "Engineering", "level": "Mid Level,Senior Level", "page": 1}
    if settings.the_muse_api_key:
        params["api_key"] = settings.the_muse_api_key

    try:
        async with limiter:
            resp = await session.get(
                "https://www.themuse.com/api/public/jobs",
                params=params,
            )
            if resp.status != 200:
                return results
            data = await resp.json(content_type=None)
    except Exception as exc:
        logger.error("the_muse_exception", exc=str(exc))
        return results

    for item in data.get("results", []):
        try:
            company = item.get("company", {}).get("name", "Unknown")
            locations = item.get("locations", [{}])
            location = locations[0].get("name") if locations else None

            results.append(RawJob(
                external_id=str(item["id"]),
                title=item["name"],
                url=item.get("refs", {}).get("landing_page", ""),
                company_slug=company.lower().replace(" ", "-"),
                company_name=company,
                ats="the_muse",
                location=location,
                remote="Remote" in (location or ""),
                posted_at=_parse_iso(item.get("publication_date")),
            ))
        except (KeyError, TypeError):
            continue

    return results


# ── HN Who's Hiring (via Algolia HN API) ─────────────────────────────────────

async def fetch_hn_hiring(session: aiohttp.ClientSession) -> list[RawJob]:
    """
    Scrape the monthly "Ask HN: Who is hiring?" thread via Algolia HN search API.
    Finds the most recent hiring thread and extracts top-level comments as job posts.

    Each comment = one job posting (no standard structure — raw text stored as description).
    """
    limiter = rate_limiter_pool.get("default")
    results: list[RawJob] = []

    try:
        # Find the latest "Who is hiring" post
        async with limiter:
            search_resp = await session.get(
                "https://hn.algolia.com/api/v1/search",
                params={
                    "query": "Ask HN: Who is hiring?",
                    "tags": "ask_hn",
                    "hitsPerPage": 3,
                },
            )
            if search_resp.status != 200:
                return results
            search_data = await search_resp.json(content_type=None)

        hits = search_data.get("hits", [])
        if not hits:
            return results

        thread_id = hits[0].get("objectID")
        if not thread_id:
            return results

        # Fetch comments from the thread
        async with limiter:
            thread_resp = await session.get(
                f"https://hn.algolia.com/api/v1/items/{thread_id}"
            )
            if thread_resp.status != 200:
                return results
            thread_data = await thread_resp.json(content_type=None)

        for child in (thread_data.get("children") or [])[:200]:
            text = child.get("text", "").strip()
            if not text or len(text) < 50:
                continue

            # First line of the comment is usually "Company | Role | Location"
            first_line = text.split("<p>")[0][:200]
            child_id = child.get("id", "")

            results.append(RawJob(
                external_id=f"hn_{thread_id}_{child_id}",
                title=first_line[:200],
                url=f"https://news.ycombinator.com/item?id={child_id}",
                company_slug="hn-who-is-hiring",
                company_name="HN Who's Hiring",
                ats="hn_hiring",
                remote=None,
                description_raw=text[:5000],  # cap size
                posted_at=_parse_iso(child.get("created_at")),
            ))

    except Exception as exc:
        logger.error("hn_hiring_exception", exc=str(exc))

    return results


# ── Registry ──────────────────────────────────────────────────────────────────

def _get_all_direct_sources():
    from jam.scraper.ats.linkedin_apify import fetch_linkedin
    from jam.scraper.ats.serpapi_jobs import fetch_serpapi
    from jam.scraper.ats.theirstack_jobs import fetch_theirstack

    return [
        ("remotive",       fetch_remotive),
        ("jobicy",         fetch_jobicy),
        ("working_nomads", fetch_working_nomads),
        ("adzuna",         fetch_adzuna),
        ("the_muse",       fetch_the_muse),
        ("hn_hiring",      fetch_hn_hiring),
        ("linkedin",       fetch_linkedin),
        ("serpapi",        fetch_serpapi),
        ("theirstack",     fetch_theirstack),
    ]

ALL_DIRECT_SOURCES = _get_all_direct_sources()


async def fetch_all_direct(session: aiohttp.ClientSession) -> dict[str, list[RawJob]]:
    """
    Run all direct API sources concurrently.
    Returns: {source_name: [RawJob, ...]}
    """
    tasks = [
        (name, asyncio.create_task(fn(session)))
        for name, fn in ALL_DIRECT_SOURCES
    ]

    results: dict[str, list[RawJob]] = {}
    for name, task in tasks:
        try:
            jobs = await task
            results[name] = jobs
            logger.info("direct_source_fetched", source=name, count=len(jobs))
        except Exception as exc:
            logger.error("direct_source_failed", source=name, exc=str(exc))
            results[name] = []

    return results
