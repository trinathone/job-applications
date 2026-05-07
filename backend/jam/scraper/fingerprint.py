"""
Job deduplication via two-tier fingerprinting.

Tier 1 — Exact (primary key):
  fingerprint = SHA256(f"{ats}:{company_slug}:{external_job_id}")
  → UNIQUE constraint on jobs.fingerprint
  → INSERT ... ON CONFLICT (fingerprint) DO UPDATE SET last_seen=NOW()

Tier 2 — Soft (advisory, cross-ATS):
  soft_key = SHA256(normalize(title + company_name))
  → Not a hard constraint; used to surface "similar job from another source"
  → Job.is_duplicate = True on soft-match against an existing canonical record
"""
from __future__ import annotations

import hashlib
import re
import unicodedata
from dataclasses import dataclass
from typing import Optional


# ── Normalization ─────────────────────────────────────────────────────────────

_STOP_WORDS = frozenset({
    "remote", "hybrid", "onsite", "on-site", "us", "uk", "eu", "ii", "iii", "iv",
    "senior", "junior", "lead", "principal", "staff", "contract", "full-time",
    "part-time", "f/m/d", "m/f/d",
})

_PUNCT_RE = re.compile(r"[^\w\s]")
_MULTI_SPACE_RE = re.compile(r"\s+")


def normalize_text(text: str) -> str:
    """
    Canonical form for soft-key generation.
    Strips accents, lowercases, removes punctuation, drops stop words.
    """
    # NFKD decompose → drop combining marks
    nfkd = unicodedata.normalize("NFKD", text)
    ascii_only = nfkd.encode("ascii", "ignore").decode("ascii")
    lower = ascii_only.lower()
    no_punct = _PUNCT_RE.sub(" ", lower)
    tokens = _MULTI_SPACE_RE.sub(" ", no_punct).strip().split()
    filtered = [t for t in tokens if t not in _STOP_WORDS and len(t) > 1]
    return " ".join(filtered)


def normalize_title(title: str) -> str:
    """Lightweight title normalization for storage (title_normalized column)."""
    return normalize_text(title)


# ── Fingerprint computation ───────────────────────────────────────────────────

def compute_fingerprint(ats: str, company_slug: str, external_job_id: str) -> str:
    """
    Primary dedup key — deterministic, collision-resistant.
    Changing any component produces a completely different fingerprint.
    """
    raw = f"{ats.lower()}:{company_slug.lower()}:{external_job_id}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def compute_soft_key(title: str, company_name: str) -> str:
    """
    Cross-ATS soft dedup key.
    Two jobs with the same normalized title+company get the same soft_key.
    """
    normalized = normalize_text(f"{title} {company_name}")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


# ── Database-level checks ─────────────────────────────────────────────────────

@dataclass
class FingerprintCheckResult:
    fingerprint: str
    soft_key: str
    exact_exists: bool        # True → same ATS+slug+id already in DB
    soft_match_job_id: Optional[int]  # ID of existing job with same soft_key (cross-ATS dup)
    is_duplicate: bool        # True → should be stored with is_duplicate=True


async def check_fingerprint(
    conn,  # asyncpg connection or SQLAlchemy async session
    ats: str,
    company_slug: str,
    external_job_id: str,
    title: str,
    company_name: str,
) -> FingerprintCheckResult:
    """
    Check both fingerprint tiers against the database.

    For SQLAlchemy async session usage:
        from sqlalchemy import text
        result = await session.execute(text("SELECT id FROM jobs WHERE fingerprint = :fp"), {"fp": fp})
    """
    from sqlalchemy import text

    fp = compute_fingerprint(ats, company_slug, external_job_id)
    sk = compute_soft_key(title, company_name)

    # Check exact fingerprint
    exact_row = await conn.execute(
        text("SELECT id FROM jobs WHERE fingerprint = :fp LIMIT 1"),
        {"fp": fp},
    )
    exact_exists = exact_row.first() is not None

    # If exact exists, no need for soft check
    if exact_exists:
        return FingerprintCheckResult(
            fingerprint=fp,
            soft_key=sk,
            exact_exists=True,
            soft_match_job_id=None,
            is_duplicate=False,  # it's an update, not a new duplicate
        )

    # Check soft key for cross-ATS duplicates
    soft_row = await conn.execute(
        text("""
            SELECT id FROM jobs
            WHERE soft_key = :sk AND is_dead = false
            ORDER BY scraped_at ASC
            LIMIT 1
        """),
        {"sk": sk},
    )
    soft_match = soft_row.first()

    return FingerprintCheckResult(
        fingerprint=fp,
        soft_key=sk,
        exact_exists=False,
        soft_match_job_id=soft_match[0] if soft_match else None,
        is_duplicate=soft_match is not None,
    )
