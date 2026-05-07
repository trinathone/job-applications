#!/usr/bin/env python3
"""
Backfill SHA256 fingerprints for jobs that were inserted before dedup was added.
Run: cd backend && uv run python ../scripts/backfill_fingerprints.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy import select, update, text
from jam.database import AsyncSessionLocal
from jam.models import Job
from jam.scraper.fingerprint import compute_fingerprint, compute_soft_key, normalize_title


async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(
            select(Job.id, Job.ats, Job.external_id, Job.title)
            .where(Job.fingerprint == "")
        )
        rows = result.all()

    print(f"Found {len(rows)} jobs needing fingerprints")
    updated = 0

    for batch_start in range(0, len(rows), 100):
        batch = rows[batch_start:batch_start + 100]
        async with AsyncSessionLocal() as session:
            for job_id, ats, external_id, title in batch:
                fp = compute_fingerprint(ats, "unknown", external_id)
                sk = compute_soft_key(title, "")
                tn = normalize_title(title)
                await session.execute(
                    update(Job)
                    .where(Job.id == job_id)
                    .values(fingerprint=fp, soft_key=sk, title_normalized=tn)
                )
                updated += 1
            await session.commit()

        print(f"  Updated {updated}/{len(rows)}", end="\r")

    print(f"\nDone. {updated} jobs updated.")


if __name__ == "__main__":
    asyncio.run(main())
