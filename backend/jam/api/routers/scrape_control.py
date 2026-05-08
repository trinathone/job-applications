"""Cloud scrape trigger used by GitHub Actions."""
from __future__ import annotations

import asyncio
import hmac
from datetime import datetime, timezone

import structlog
from fastapi import APIRouter, BackgroundTasks, Header, HTTPException

from jam.config import settings

router = APIRouter(prefix="/api/scrape", tags=["scrape"])
logger = structlog.get_logger(__name__)
_running = False


async def _run_cloud_scrape(run_id: str) -> None:
    global _running
    try:
        from jam.scraper.pipeline import run_full_pipeline
        stats = await run_full_pipeline(run_id=run_id)
        logger.info(
            "cloud_scrape_complete",
            run_id=run_id,
            jobs_new=stats.jobs_new,
            jobs_fetched=stats.jobs_fetched,
        )
    except Exception as exc:
        logger.error("cloud_scrape_failed", run_id=run_id, error=str(exc))
    finally:
        _running = False


@router.post("/run")
async def run_scrape(
    background_tasks: BackgroundTasks,
    x_scrape_token: str | None = Header(default=None),
) -> dict[str, str | bool]:
    global _running

    if not settings.scrape_trigger_token:
        raise HTTPException(status_code=503, detail="Scrape trigger token is not configured.")
    if not x_scrape_token or not hmac.compare_digest(x_scrape_token, settings.scrape_trigger_token):
        raise HTTPException(status_code=403, detail="Invalid scrape token.")
    if _running:
        return {"ok": True, "started": False, "status": "already_running"}

    _running = True
    run_id = f"cloud-{datetime.now(tz=timezone.utc).strftime('%Y%m%d-%H%M%S')}"
    background_tasks.add_task(_run_cloud_scrape, run_id)
    return {"ok": True, "started": True, "run_id": run_id}


@router.get("/status")
async def scrape_status() -> dict[str, bool]:
    return {"running": _running}
