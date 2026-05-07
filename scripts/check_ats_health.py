#!/usr/bin/env python3
"""
Quick CLI health check for all ATS endpoints.
Tests one slug per ATS and reports status.
Run: cd backend && uv run python ../scripts/check_ats_health.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

import aiohttp
from jam.scraper.ats.greenhouse import GreenhouseScraper
from jam.scraper.ats.lever import LeverScraper
from jam.scraper.ats.ashby import AshbyScraper
from jam.scraper.session import create_session

TEST_SLUGS = {
    "greenhouse": "stripe",
    "lever": "scale-ai",
    "ashby": "anthropic",
}

SCRAPER_CLASSES = {
    "greenhouse": GreenhouseScraper,
    "lever": LeverScraper,
    "ashby": AshbyScraper,
}


async def main():
    print("JAM ATS Health Check\n" + "=" * 40)
    async with create_session() as session:
        for ats, slug in TEST_SLUGS.items():
            scraper = SCRAPER_CLASSES[ats](session)
            result = await scraper.scrape(slug)
            status_icon = "✓" if result.status in ("ok", "ok_empty") else "✗"
            print(
                f"{status_icon} {ats:15s} slug={slug:20s} "
                f"status={result.status} jobs={len(result.jobs)} "
                f"ms={result.duration_ms}"
            )


if __name__ == "__main__":
    asyncio.run(main())
