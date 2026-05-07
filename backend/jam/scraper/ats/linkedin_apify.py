"""
LinkedIn jobs via Apify actor scraper.

Actor: hKByXkMQaC5Qt9UMN (linkedin-jobs-scraper)
Flow:
  1. POST /v2/acts/{actorId}/runs  — start a run
  2. Poll /v2/actor-runs/{runId}   — wait for SUCCEEDED (max 5 min)
  3. GET  /v2/datasets/{datasetId}/items — fetch all items
  4. Normalize → list[RawJob]

Run once per pipeline execution (no per-slug iteration).
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

APIFY_BASE = "https://api.apify.com/v2"

# Search configurations: (keywords, location)
LINKEDIN_SEARCHES = [
    ("software engineer", "United States"),
    ("software developer", "United States"),
    ("backend engineer", "United States"),
    ("frontend engineer", "United States"),
    ("full stack engineer", "United States"),
    ("machine learning engineer", "United States"),
]


def _parse_salary(salary_str: str | None) -> tuple[int | None, int | None]:
    """Parse '$125,000/yr - $150,000/yr' → (125000, 150000)."""
    if not salary_str:
        return None, None
    import re
    nums = re.findall(r"[\d,]+", salary_str)
    nums = [int(n.replace(",", "")) for n in nums if len(n.replace(",", "")) > 3]
    if len(nums) >= 2:
        return nums[0], nums[1]
    if len(nums) == 1:
        return nums[0], None
    return None, None


def _parse_ts(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _normalize(item: dict[str, Any]) -> RawJob | None:
    try:
        job_id = str(item["id"])
        title = item.get("title") or item.get("standardizedTitle") or ""
        company = item.get("companyName") or "Unknown"
        link = item.get("applyUrl") or item.get("link") or ""
        location = item.get("location") or ""
        remote = item.get("workRemoteAllowed", False)
        description = item.get("descriptionText") or item.get("descriptionHtml") or None
        salary_min, salary_max = _parse_salary(item.get("salary"))

        # salary from salaryInsights
        if salary_min is None and item.get("salaryInsights"):
            for cb in item["salaryInsights"].get("compensationBreakdown", []):
                if cb.get("payPeriod") == "YEARLY":
                    mn = cb.get("minSalary")
                    mx = cb.get("maxSalary")
                    salary_min = int(float(mn)) if mn else None
                    salary_max = int(float(mx)) if mx else None
                    break

        posted_at = _parse_ts(item.get("postedAt"))

        company_slug = company.lower().replace(" ", "-").replace(".", "").replace(",", "")[:80]

        return RawJob(
            external_id=f"li_{job_id}",
            title=title,
            url=link,
            company_slug=company_slug,
            company_name=company,
            ats="linkedin",
            location=location,
            remote=bool(remote),
            description_raw=description[:8000] if description else None,
            posted_at=posted_at,
            salary_min=salary_min,
            salary_max=salary_max,
        )
    except Exception as exc:
        logger.warning("linkedin_normalize_error", exc=str(exc))
        return None


async def _run_actor(session: aiohttp.ClientSession, search_url: str) -> list[dict]:
    """Trigger one actor run, wait for it, return dataset items."""
    token = settings.apify_token
    actor_id = settings.apify_linkedin_actor_id

    # Start run
    try:
        resp = await session.post(
            f"{APIFY_BASE}/acts/{actor_id}/runs",
            params={"token": token},
            json={
                "urls": [search_url],
                "count": 50,
                "scrapeCompany": False,
                "splitByLocation": False,
            },
            timeout=aiohttp.ClientTimeout(total=30),
        )
        if resp.status not in (200, 201):
            logger.warning("apify_run_start_failed", status=resp.status, url=search_url)
            return []
        run_data = await resp.json()
        run_id = run_data["data"]["id"]
        dataset_id = run_data["data"]["defaultDatasetId"]
    except Exception as exc:
        logger.error("apify_run_start_error", exc=str(exc))
        return []

    # Poll for completion (max 5 min)
    for _ in range(30):
        await asyncio.sleep(10)
        try:
            status_resp = await session.get(
                f"{APIFY_BASE}/actor-runs/{run_id}",
                params={"token": token},
                timeout=aiohttp.ClientTimeout(total=15),
            )
            status_data = await status_resp.json()
            status = status_data["data"]["status"]
            if status == "SUCCEEDED":
                break
            if status in ("FAILED", "ABORTED", "TIMED-OUT"):
                logger.warning("apify_run_failed", status=status, run_id=run_id)
                return []
        except Exception as exc:
            logger.warning("apify_poll_error", exc=str(exc))
            continue
    else:
        logger.warning("apify_run_timeout", run_id=run_id)
        return []

    # Fetch results
    try:
        items_resp = await session.get(
            f"{APIFY_BASE}/datasets/{dataset_id}/items",
            params={"token": token, "limit": 200},
            timeout=aiohttp.ClientTimeout(total=30),
        )
        return await items_resp.json()
    except Exception as exc:
        logger.error("apify_fetch_items_error", exc=str(exc))
        return []


async def fetch_linkedin(session: aiohttp.ClientSession) -> list[RawJob]:
    """
    Fetch LinkedIn jobs for all configured searches via Apify.
    Runs actors in parallel (up to 3 at a time to control cost).
    """
    if not settings.apify_token:
        logger.debug("linkedin_skipped", reason="no_apify_token")
        return []

    results: list[RawJob] = []
    seen_ids: set[str] = set()
    sem = asyncio.Semaphore(3)

    async def run_one(keywords: str, location: str) -> list[RawJob]:
        encoded_kw = keywords.replace(" ", "%20")
        encoded_loc = location.replace(" ", "%20").replace(",", "%2C")
        url = f"https://www.linkedin.com/jobs/search/?keywords={encoded_kw}&location={encoded_loc}&position=1&pageNum=0"

        async with sem:
            items = await _run_actor(session, url)

        jobs: list[RawJob] = []
        for item in items:
            job = _normalize(item)
            if job and job.external_id not in seen_ids:
                seen_ids.add(job.external_id)
                jobs.append(job)
        logger.info("linkedin_fetched", keywords=keywords, count=len(jobs))
        return jobs

    tasks = [asyncio.create_task(run_one(kw, loc)) for kw, loc in LINKEDIN_SEARCHES]
    for task in asyncio.as_completed(tasks):
        try:
            jobs = await task
            results.extend(jobs)
        except Exception as exc:
            logger.error("linkedin_task_error", exc=str(exc))

    logger.info("linkedin_total", count=len(results))
    return results
