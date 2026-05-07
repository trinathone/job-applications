"""Load company seeds from JSON into the database (idempotent)."""
from __future__ import annotations

import json
from pathlib import Path

SEEDS_FILE = Path(__file__).parent / "company_seeds.json"


def load_seeds() -> list[dict]:
    with open(SEEDS_FILE) as f:
        return json.load(f)
