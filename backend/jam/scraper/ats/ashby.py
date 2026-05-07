"""
Ashby ATS scraper.

Ashby exposes a public non-user GraphQL API:
  POST https://api.ashbyhq.com/posting-api/job-board/{slug}
  Content-Type: application/json

GraphQL query returns job listings with full details including compensation.
Falls back to REST endpoint if GraphQL fails.

REST endpoint: https://api.ashbyhq.com/posting-api/job-board/{slug}
Response: { "jobs": [...], "jobBoard": {...} }
"""
from __future__ import annotations

import html
import re
from datetime import datetime, timezone
from typing import Any

import aiohttp

from jam.scraper.base import BaseScraper, RawJob

_HTML_TAG_RE = re.compile(r"<[^>]+>")

GRAPHQL_QUERY = """
query JobBoard($boardHandle: String!) {
  jobBoard: jobPostingsForBoard(boardHandle: $boardHandle) {
    jobPostings {
      id
      title
      locationName
      isRemote
      externalLink
      publishedDate
      descriptionHtml
      compensationTierSummary
      compensationTiers {
        minValue
        maxValue
        currency
      }
    }
  }
}
"""


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

    async def fetch(self, slug: str) -> tuple[Any, Any, int]:
        """
        Override fetch to try GraphQL first, fall back to REST.
        """
        from jam.scraper.error_taxonomy import ErrorKind

        graphql_url = f"https://api.ashbyhq.com/posting-api/non-user-graphql"

        async with self._limiter:
            try:
                resp = await self._session.post(
                    graphql_url,
                    json={"query": GRAPHQL_QUERY, "variables": {"boardHandle": slug}},
                    headers={"Content-Type": "application/json"},
                )
                if resp.status == 200:
                    data = await resp.json(content_type=None)
                    if data and "data" in data:
                        # Flatten GraphQL structure to match REST shape
                        postings = (
                            (data.get("data") or {})
                            .get("jobBoard", {})
                            .get("jobPostings", [])
                        )
                        return {"jobs": postings}, ErrorKind.OK, 200
            except Exception:
                pass  # Fall through to REST

        # REST fallback
        return await super().fetch(slug)
