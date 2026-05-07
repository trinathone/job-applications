#!/usr/bin/env python3
"""
Idempotent seed loader — safe to run multiple times.
Run: cd backend && uv run python ../scripts/seed_db.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from sqlalchemy.dialects.postgresql import insert as pg_insert
from jam.database import AsyncSessionLocal
from jam.models import Company
from jam.seeds.loader import load_seeds


async def main():
    seeds = load_seeds()
    async with AsyncSessionLocal() as session:
        stmt = (
            pg_insert(Company)
            .values([
                {"slug": s["slug"], "ats": s["ats"], "name": s["name"], "active": s.get("active", True)}
                for s in seeds
            ])
            .on_conflict_do_nothing(index_elements=["slug"])
        )
        await session.execute(stmt)
        await session.commit()
    print(f"Seeded {len(seeds)} companies (skipped existing).")


if __name__ == "__main__":
    asyncio.run(main())
