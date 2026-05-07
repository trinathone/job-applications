"""
Lever ATS scraper.

API endpoint: https://api.lever.co/v0/postings/{slug}?mode=json
Response shape: array of posting objects
  [
    {
      "id": "uuid-here",
      "text": "Senior Backend Engineer",
      "categories": {"location": "San Francisco", "team": "Engineering"},
      "tags": ["Remote OK"],
      "description": "<html>...",
      "descriptionPlain": "plain text...",
      "hostedUrl": "https://jobs.lever.co/stripe/uuid",
      "createdAt": 1705276800000,  // ms epoch
      "salaryRange": {"min": 150000, "max": 220000, "currency": "USD"}
    },
    ...
  ]

Rate limit: generous (~100 req/10s), we stay conservative at 5 rps.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from jam.scraper.base import BaseScraper, RawJob


def _ms_epoch_to_dt(ms: int | None) -> datetime | None:
    if ms is None:
        return None
    try:
        return datetime.fromtimestamp(int(ms) / 1000, tz=timezone.utc)
    except (ValueError, OSError, OverflowError):
        return None


class LeverScraper(BaseScraper):
    ats = "lever"
    _BASE = "https://api.lever.co/v0/postings"

    def build_url(self, slug: str) -> str:
        return f"{self._BASE}/{slug}?mode=json&limit=500"

    def parse_response(self, data: Any, slug: str) -> list[RawJob]:
        if not isinstance(data, list):
            raise ValueError(f"Expected list, got {type(data)}")

        results: list[RawJob] = []
        for item in data:
            try:
                job_id = item.get("id", "").strip()
                title = item.get("text", "").strip()
                if not job_id or not title:
                    continue

                categories = item.get("categories") or {}
                location = categories.get("location") or categories.get("allLocations", [None])[0]

                tags = item.get("tags") or []
                remote = any("remote" in t.lower() for t in tags if isinstance(t, str))
                if not remote and location:
                    remote = "remote" in location.lower()

                url = item.get("hostedUrl", "").strip()
                if not url:
                    url = f"https://jobs.lever.co/{slug}/{job_id}"

                # Prefer plain-text description, fall back to HTML
                description = (
                    item.get("descriptionPlain")
                    or item.get("description")
                    or ""
                ).strip() or None

                salary_range = item.get("salaryRange") or {}
                salary_min = salary_range.get("min")
                salary_max = salary_range.get("max")

                results.append(
                    RawJob(
                        external_id=job_id,
                        title=title,
                        url=url,
                        company_slug=slug,
                        company_name=slug.replace("-", " ").title(),
                        ats=self.ats,
                        location=location if isinstance(location, str) else None,
                        remote=remote if isinstance(remote, bool) else None,
                        description_raw=description,
                        posted_at=_ms_epoch_to_dt(item.get("createdAt")),
                        salary_min=int(salary_min) if salary_min else None,
                        salary_max=int(salary_max) if salary_max else None,
                    )
                )
            except (KeyError, TypeError):
                continue

        return results
