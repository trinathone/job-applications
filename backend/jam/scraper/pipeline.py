"""
Scraper pipeline — orchestrates fetch → dedup → upsert → publish.

Flow per scrape run:
  1. Load active companies from DB
  2. Fan out concurrent scrapes (bounded by semaphore)
  3. For each RawJob: compute fingerprint → check DB → upsert
  4. Publish new job IDs to Redis pub/sub for SSE
  5. Log ScrapeRun record for observability
  6. Trigger enrichment task for newly inserted jobs
"""
from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Optional

import redis.asyncio as aioredis
import structlog
from sqlalchemy import select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from jam.config import settings
from jam.database import db_session
from jam.models import Company, Job, ScrapeRun
from jam.scraper.ats.ashby import AshbyScraper
from jam.scraper.ats.direct_apis import fetch_all_direct
from jam.scraper.ats.greenhouse import GreenhouseScraper
from jam.scraper.ats.lever import LeverScraper
from jam.scraper.base import RawJob, ScrapeResult
from jam.scraper.error_taxonomy import ErrorKind
from jam.scraper.fingerprint import compute_fingerprint, compute_soft_key, normalize_title
from jam.scraper.session import create_session

logger = structlog.get_logger(__name__)

# ATS → scraper class
ATS_SCRAPERS = {
    "greenhouse": GreenhouseScraper,
    "lever":      LeverScraper,
    "ashby":      AshbyScraper,
}


@dataclass
class PipelineStats:
    slugs_attempted: int = 0
    slugs_ok: int = 0
    slugs_dead: int = 0
    slugs_rate_limited: int = 0
    slugs_empty: int = 0
    slugs_error: int = 0
    jobs_fetched: int = 0
    jobs_new: int = 0
    jobs_updated: int = 0
    jobs_duplicate: int = 0
    new_job_ids: list[int] = field(default_factory=list)
    source_breakdown: dict[str, int] = field(default_factory=dict)


async def _upsert_job(
    session: AsyncSession,
    raw: RawJob,
    company_id: int,
) -> tuple[Optional[int], bool]:
    """
    INSERT job with ON CONFLICT fingerprint → UPDATE last_seen.
    Returns: (job_id, is_new)
    """
    fp = compute_fingerprint(raw.ats, raw.company_slug, raw.external_id)
    sk = compute_soft_key(raw.title, raw.company_name)
    title_norm = normalize_title(raw.title)

    # Check for cross-ATS soft duplicate
    is_duplicate_check = await session.execute(
        text("SELECT id FROM jobs WHERE soft_key = :sk AND is_dead = false LIMIT 1"),
        {"sk": sk},
    )
    soft_match = is_duplicate_check.first()
    is_duplicate = soft_match is not None

    stmt = pg_insert(Job).values(
        fingerprint=fp,
        soft_key=sk,
        company_id=company_id,
        external_id=raw.external_id,
        ats=raw.ats,
        title=raw.title,
        title_normalized=title_norm,
        location=raw.location,
        remote=raw.remote,
        url=raw.url,
        description_raw=raw.description_raw,
        posted_at=raw.posted_at,
        yoe_min=raw.yoe_min,
        yoe_max=raw.yoe_max,
        yoe_source=raw.yoe_source,
        salary_min=raw.salary_min,
        salary_max=raw.salary_max,
        is_duplicate=is_duplicate,
        needs_extraction=(raw.description_raw is not None),
    ).on_conflict_do_update(
        index_elements=["fingerprint"],
        set_={
            "last_seen": datetime.now(tz=timezone.utc),
            "is_dead": False,  # un-mark if it was previously dead and re-appeared
        },
    ).returning(Job.id, text("(xmax = 0) AS is_insert"))
    # xmax = 0 means it was an INSERT (not an UPDATE)

    result = await session.execute(stmt)
    row = result.first()
    if row is None:
        return None, False

    job_id, is_new = row
    return job_id, bool(is_new)


async def _get_or_create_company(
    session: AsyncSession,
    slug: str,
    ats: str,
    company_name: str,
) -> int:
    """Get existing company ID or create a new record."""
    result = await session.execute(
        select(Company.id).where(Company.slug == slug, Company.ats == ats)
    )
    row = result.first()
    if row:
        return row[0]

    stmt = pg_insert(Company).values(
        slug=slug,
        ats=ats,
        name=company_name,
        active=True,
    ).on_conflict_do_nothing(index_elements=["slug"])

    await session.execute(stmt)
    await session.flush()

    result = await session.execute(
        select(Company.id).where(Company.slug == slug)
    )
    return result.scalar_one()


async def _find_company_id(
    session: AsyncSession,
    slug: str,
    ats: str,
) -> Optional[int]:
    """Return the seeded company id even when the scrape returned no jobs."""
    result = await session.execute(
        select(Company.id).where(Company.slug == slug, Company.ats == ats)
    )
    return result.scalar_one_or_none()


async def _log_scrape_run(
    session: AsyncSession,
    result: ScrapeResult,
    company_id: Optional[int],
    jobs_new: int,
    jobs_updated: int,
) -> int:
    """Insert a ScrapeRun record and return its ID."""
    run = ScrapeRun(
        company_id=company_id,
        ats=result.ats,
        slug=result.slug,
        finished_at=datetime.now(tz=timezone.utc),
        status=_status_from_result(result),
        jobs_found=len(result.jobs),
        jobs_new=jobs_new,
        jobs_updated=jobs_updated,
        error_kind=result.error_kind.value if result.error_kind else None,
        error_detail=result.error_detail,
        http_status=result.http_status,
        duration_ms=result.duration_ms,
    )
    session.add(run)
    await session.flush()
    return run.id


def _status_from_result(result: ScrapeResult) -> str:
    if result.status == "ok" and result.jobs:
        return "success"
    if result.status == "ok_empty":
        return "success"
    if result.error_kind == ErrorKind.DEAD:
        return "failed"
    if result.error_kind == ErrorKind.RATE_LIMITED:
        return "skipped"
    if result.status in ("parse_error", "http_5xx"):
        return "partial"
    return "failed"


async def process_scrape_result(
    result: ScrapeResult,
    redis_client: aioredis.Redis,
) -> tuple[int, int, list[int]]:
    """
    Process a single ScrapeResult: upsert jobs, log run, publish new jobs.
    Returns: (jobs_new, jobs_updated)
    """
    jobs_new = 0
    jobs_updated = 0
    new_ids: list[int] = []

    async with db_session() as session:
        # Get or create company
        company_id: Optional[int] = await _find_company_id(session, result.slug, result.ats)
        if result.jobs:
            first = result.jobs[0]
            if company_id is None:
                company_id = await _get_or_create_company(
                    session, first.company_slug, result.ats, first.company_name
                )

        # Mark dead slug
        if result.error_kind == ErrorKind.DEAD and company_id:
            await session.execute(
                text("""
                    UPDATE companies
                    SET active=false, last_fail_at=now(),
                        consecutive_fails=consecutive_fails + 1
                    WHERE id=:cid
                """),
                {"cid": company_id},
            )
        elif result.status in ("ok", "ok_empty") and company_id:
            await session.execute(
                text("""
                    UPDATE companies
                    SET last_success_at=now(), consecutive_fails=0
                    WHERE id=:cid
                """),
                {"cid": company_id},
            )
        elif result.error_kind and company_id:
            await session.execute(
                text("""
                    UPDATE companies
                    SET last_fail_at=now(),
                        consecutive_fails=consecutive_fails + 1
                    WHERE id=:cid
                """),
                {"cid": company_id},
            )

        # Upsert all jobs
        for raw in result.jobs:
            try:
                if company_id is None:
                    company_id = await _get_or_create_company(
                        session, raw.company_slug, raw.ats, raw.company_name
                    )
                job_id, is_new = await _upsert_job(session, raw, company_id)
                if job_id is None:
                    continue
                if is_new:
                    jobs_new += 1
                    new_ids.append(job_id)
                else:
                    jobs_updated += 1
            except Exception as exc:
                logger.error(
                    "upsert_job_error",
                    slug=result.slug,
                    external_id=raw.external_id,
                    exc=str(exc),
                )

        await _log_scrape_run(session, result, company_id, jobs_new, jobs_updated)

    # Publish new jobs to Redis pub/sub for SSE clients
    if new_ids:
        payload = json.dumps({
            "event": "jobs_new",
            "ats": result.ats,
            "slug": result.slug,
            "job_ids": new_ids,
            "count": jobs_new,
        })
        await redis_client.publish("jam:feed", payload)

    return jobs_new, jobs_updated, new_ids


async def run_full_pipeline(*, run_id: Optional[str] = None) -> PipelineStats:
    """
    Main entry point — runs all ATS slug scrapes + direct API sources concurrently.
    Called from Celery task.
    """
    stats = PipelineStats()
    redis_client = aioredis.from_url(settings.redis_url, decode_responses=True)

    async with db_session() as session:
        companies_result = await session.execute(
            select(Company).where(Company.active == True)
        )
        companies = companies_result.scalars().all()

    logger.info("pipeline_start", company_count=len(companies), run_id=run_id)

    async with create_session() as http_session:
        # ── ATS slug scrapes ─────────────────────────────────────────────────
        fetch_semaphore = asyncio.Semaphore(settings.scraper_max_concurrent)
        db_write_semaphore = asyncio.Semaphore(max(1, min(settings.db_pool_size, 3)))

        async def scrape_one(company: Company) -> None:
            scraper_cls = ATS_SCRAPERS.get(company.ats)
            if not scraper_cls:
                return

            scraper = scraper_cls(http_session)
            async with fetch_semaphore:
                result = await scraper.scrape(company.slug)

            stats.slugs_attempted += 1

            if result.status == "ok":
                stats.slugs_ok += 1
            elif result.status == "ok_empty":
                stats.slugs_empty += 1
            elif result.error_kind == ErrorKind.DEAD:
                stats.slugs_dead += 1
            elif result.error_kind == ErrorKind.RATE_LIMITED:
                stats.slugs_rate_limited += 1
            else:
                stats.slugs_error += 1

            stats.jobs_fetched += len(result.jobs)
            async with db_write_semaphore:
                new, updated, new_ids = await process_scrape_result(result, redis_client)
            stats.jobs_new += new
            stats.jobs_updated += updated
            stats.new_job_ids.extend(new_ids)
            stats.source_breakdown[company.ats] = (
                stats.source_breakdown.get(company.ats, 0) + new
            )

        results = await asyncio.gather(
            *[scrape_one(c) for c in companies],
            return_exceptions=True,
        )
        for exc in results:
            if isinstance(exc, Exception):
                logger.error("scrape_one_unhandled_error", exc=str(exc))

        # ── Direct API sources ───────────────────────────────────────────────
        direct_results = await fetch_all_direct(http_session)

    for source, raw_jobs in direct_results.items():
        # Build a synthetic ScrapeResult for each direct source
        from jam.scraper.base import ScrapeResult as SR
        result = SR(slug=source, ats=source, status="ok", jobs=raw_jobs)
        stats.jobs_fetched += len(raw_jobs)
        new, updated, new_ids = await process_scrape_result(result, redis_client)
        stats.jobs_new += new
        stats.jobs_updated += updated
        stats.new_job_ids.extend(new_ids)
        stats.source_breakdown[source] = stats.source_breakdown.get(source, 0) + new

    await redis_client.aclose()

    # Emit summary event
    redis_client2 = aioredis.from_url(settings.redis_url, decode_responses=True)
    await redis_client2.publish("jam:feed", json.dumps({
        "event": "scrape_complete",
        "jobs_new": stats.jobs_new,
        "jobs_total": stats.jobs_fetched,
        "sources": stats.source_breakdown,
        "run_id": run_id,
    }))
    await redis_client2.aclose()

    logger.info(
        "pipeline_complete",
        jobs_new=stats.jobs_new,
        jobs_fetched=stats.jobs_fetched,
        slugs_attempted=stats.slugs_attempted,
        slugs_dead=stats.slugs_dead,
        run_id=run_id,
    )

    return stats
