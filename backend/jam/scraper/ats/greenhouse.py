"""
Greenhouse ATS scraper.

API endpoint: https://boards-api.greenhouse.io/v1/boards/{slug}/jobs
Response shape:
  {
    "jobs": [
      {
        "id": 12345,
        "title": "Senior Software Engineer",
        "location": {"name": "San Francisco, CA"},
        "absolute_url": "https://boards.greenhouse.io/stripe/jobs/12345",
        "content": "<html>...",  // full JD HTML
        "updated_at": "2025-01-15T00:00:00.000Z"
      }
    ],
    "meta": {"total": 42}
  }

Rate limit: ~40 req/10s per IP, conservative at 4 rps in our limiter.
No auth required for public boards.
"""
from __future__ import annotations

import html
import re
from datetime import datetime
from typing import Any

from jam.scraper.base import BaseScraper, RawJob

_HTML_TAG_RE = re.compile(r"<[^>]+>")


def _strip_html(text: str) -> str:
    """Best-effort HTML→plaintext. Greenhouse returns HTML in `content`."""
    if not text:
        return ""
    no_tags = _HTML_TAG_RE.sub(" ", text)
    decoded = html.unescape(no_tags)
    return " ".join(decoded.split())


def _parse_posted_at(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


class GreenhouseScraper(BaseScraper):
    ats = "greenhouse"
    _BASE = "https://boards-api.greenhouse.io/v1/boards"

    def build_url(self, slug: str) -> str:
        return f"{self._BASE}/{slug}/jobs?content=true"

    def parse_response(self, data: Any, slug: str) -> list[RawJob]:
        if not isinstance(data, dict):
            raise ValueError(f"Expected dict, got {type(data)}")

        jobs_raw = data.get("jobs", [])
        if not isinstance(jobs_raw, list):
            raise ValueError(f"'jobs' field is not a list: {type(jobs_raw)}")

        results: list[RawJob] = []
        for item in jobs_raw:
            try:
                job_id = str(item["id"])
                title = item.get("title", "").strip()
                if not title or not job_id:
                    continue

                location_obj = item.get("location") or {}
                location = location_obj.get("name") if isinstance(location_obj, dict) else None

                # Greenhouse doesn't have a dedicated remote field; infer from location
                remote = None
                if location:
                    remote = "remote" in location.lower()

                url = item.get("absolute_url", "").strip()
                if not url:
                    url = f"https://boards.greenhouse.io/{slug}/jobs/{job_id}"

                description_html = item.get("content", "")
                description = _strip_html(description_html) if description_html else None

                results.append(
                    RawJob(
                        external_id=job_id,
                        title=title,
                        url=url,
                        company_slug=slug,
                        company_name=slug.replace("-", " ").title(),
                        ats=self.ats,
                        location=location,
                        remote=remote,
                        description_raw=description,
                        posted_at=_parse_posted_at(item.get("updated_at")),
                    )
                )
            except (KeyError, TypeError):
                # Skip malformed entries; log is handled by base scraper
                continue

        return results
