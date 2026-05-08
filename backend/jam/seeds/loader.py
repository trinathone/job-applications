"""Load company seeds from JSON into the database (idempotent)."""
from __future__ import annotations

import json
from pathlib import Path

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from jam.models import Company

SEEDS_FILE = Path(__file__).parent / "company_seeds.json"


def load_seeds() -> list[dict]:
    with open(SEEDS_FILE) as f:
        return json.load(f)


async def ensure_company_seeds(session: AsyncSession) -> int:
    """Insert/update seeded job boards so cloud scrapes always have sources."""
    seeds = load_seeds()
    if not seeds:
        return 0

    rows = [
        {
            "slug": str(seed["slug"]).strip(),
            "ats": str(seed["ats"]).strip(),
            "name": str(seed["name"]).strip(),
            "active": bool(seed.get("active", True)),
            "career_url": seed.get("career_url"),
        }
        for seed in seeds
        if seed.get("slug") and seed.get("ats") and seed.get("name")
    ]
    if not rows:
        return 0

    stmt = pg_insert(Company).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["slug"],
        set_={
            "name": stmt.excluded.name,
            "ats": stmt.excluded.ats,
            "career_url": stmt.excluded.career_url,
        },
    )
    await session.execute(stmt)
    return len(rows)
