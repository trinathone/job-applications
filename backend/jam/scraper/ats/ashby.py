"""
Ashby ATS scraper.

Ashby's public REST endpoint returns job listings without auth:
  GET https://api.ashbyhq.com/posting-api/job-board/{slug}

Response: { "jobs": [...], "jobBoard": {...} }
"""
from __future__ import annotations

import html
import re
from datetime import datetime, timezone
from typing import Any

from jam.scraper.base import BaseScraper, RawJob

_HTML_TAG_RE = re.compile(r"<[^>]+>")

def _strip_html(text: str) -> str:
    if not text:
        return ""
    no_tags = _HTML_TAG_RE.sub(" ", text)
    return " ".join(html.unescape(no_tags).split())


def _parse_date(raw: str | None) -> datetime | None:
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


class AshbyScraper(BaseScraper):
    ats = "ashby"
    _REST_BASE = "https://api.ashbyhq.com/posting-api/job-board"

    def build_url(self, slug: str) -> str:
        return f"{self._REST_BASE}/{slug}"

    def parse_response(self, data: Any, slug: str) -> list[RawJob]:
        """Parse the REST response format."""
        if not isinstance(data, dict):
            raise ValueError(f"Expected dict, got {type(data)}")

        jobs_raw = data.get("jobs") or data.get("jobPostings") or []
        if not isinstance(jobs_raw, list):
            raise ValueError(f"jobs field is not a list: {type(jobs_raw)}")

        results: list[RawJob] = []
        for item in jobs_raw:
            try:
                job_id = str(item.get("id", "")).strip()
                title = item.get("title", "").strip()
                if not job_id or not title:
                    continue

                location = item.get("locationName") or item.get("location") or None
                is_remote = item.get("isRemote") or item.get("remote") or False
                if not is_remote and location:
                    is_remote = "remote" in str(location).lower()

                url = (
                    item.get("externalLink")
                    or item.get("hostedUrl")
                    or f"https://jobs.ashbyhq.com/{slug}/{job_id}"
                )

                desc_html = item.get("descriptionHtml") or item.get("description") or ""
                description = _strip_html(desc_html) or None

                # Parse compensation
                salary_min = salary_max = None
                tiers = item.get("compensationTiers") or []
                if tiers:
                    first_tier = tiers[0]
                    salary_min = first_tier.get("minValue")
                    salary_max = first_tier.get("maxValue")

                results.append(
                    RawJob(
                        external_id=job_id,
                        title=title,
                        url=url.strip(),
                        company_slug=slug,
                        company_name=slug.replace("-", " ").title(),
                        ats=self.ats,
                        location=location,
                        remote=bool(is_remote),
                        description_raw=description,
                        posted_at=_parse_date(item.get("publishedDate")),
                        salary_min=int(salary_min) if salary_min else None,
                        salary_max=int(salary_max) if salary_max else None,
                    )
                )
            except (KeyError, TypeError):
                continue

        return results
