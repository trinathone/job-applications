"""
Pydantic v2 request/response schemas.
These are the API contract — separate from ORM models.
"""
from __future__ import annotations

from datetime import date, datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field


# ── Shared ────────────────────────────────────────────────────────────────────

class OrmBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ── Company ───────────────────────────────────────────────────────────────────

class CompanyOut(OrmBase):
    id: int
    slug: str
    name: str
    ats: str
    active: bool


# ── Job ───────────────────────────────────────────────────────────────────────

class JobOut(OrmBase):
    id: int
    fingerprint: str
    ats: str
    title: str
    location: Optional[str]
    remote: Optional[bool]
    url: str
    yoe_min: Optional[int]
    yoe_max: Optional[int]
    yoe_source: Optional[str]
    salary_min: Optional[int]
    salary_max: Optional[int]
    posted_at: Optional[datetime]
    scraped_at: datetime
    is_dead: bool
    is_duplicate: bool
    company: CompanyOut


class JobListResponse(BaseModel):
    items: list[JobOut]
    total: int
    cursor: Optional[datetime] = None   # keyset pagination cursor


class JobFilters(BaseModel):
    ats: Optional[str] = None
    remote: Optional[bool] = None
    yoe_max: Optional[int] = Field(default=None, ge=0, le=20)
    since: Optional[datetime] = None
    cursor: Optional[datetime] = None
    limit: int = Field(default=50, ge=1, le=200)
    include_dead: bool = False
    include_duplicate: bool = False


# ── Application ───────────────────────────────────────────────────────────────

ApplicationStatus = Literal[
    "saved", "applied", "interviewing", "offer", "rejected", "archived", "skipped"
]

class ApplicationCreate(BaseModel):
    job_id: int
    # user_id is NOT accepted from the client — it is always taken from the JWT
    status: ApplicationStatus = "saved"
    skip_reason: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = None
    cover_letter: Optional[str] = None


class ApplicationUpdate(BaseModel):
    status: Optional[ApplicationStatus] = None
    skip_reason: Optional[str] = Field(default=None, max_length=100)
    notes: Optional[str] = None
    cover_letter: Optional[str] = None
    got_response: Optional[bool] = None


class ApplicationOut(OrmBase):
    id: int
    job_id: int
    user_id: int
    status: str
    skip_reason: Optional[str]
    applied_at: Optional[datetime]
    session_date: date
    notes: Optional[str]
    got_response: Optional[bool]
    created_at: datetime
    updated_at: datetime
    # Enriched from Job (populated by list_applications, None on upsert responses)
    job_title: Optional[str] = None
    job_company_name: Optional[str] = None
    job_url: Optional[str] = None


# ── SSE Events ────────────────────────────────────────────────────────────────

class SSEJobEvent(BaseModel):
    event: Literal["job_new", "job_updated", "job_dead", "scrape_complete", "heartbeat"]
    data: Any
    ts: datetime = Field(default_factory=datetime.utcnow)
    run_id: Optional[str] = None


class SSEScrapeComplete(BaseModel):
    jobs_new: int
    jobs_total: int
    sources: dict[str, int]  # ats → new job count


# ── Health ────────────────────────────────────────────────────────────────────

class ComponentHealth(BaseModel):
    status: Literal["ok", "degraded", "down"]
    latency_ms: Optional[int] = None
    detail: Optional[str] = None


class HealthResponse(BaseModel):
    status: Literal["ok", "degraded", "down"]
    db: ComponentHealth
    redis: ComponentHealth
    celery: ComponentHealth
    last_scrape_run: Optional[datetime]


# ── Scrape Admin ──────────────────────────────────────────────────────────────

class ScrapeRunOut(OrmBase):
    id: int
    ats: str
    slug: str
    started_at: datetime
    finished_at: Optional[datetime]
    status: str
    jobs_found: int
    jobs_new: int
    error_kind: Optional[str]
    duration_ms: Optional[int]


class ScrapeHealthResponse(BaseModel):
    runs_last_7d: list[ScrapeRunOut]
    success_rate_7d: float
    avg_jobs_per_run: float
    dead_slugs_count: int
    dormant_slugs_count: int


# ── Dashboard ─────────────────────────────────────────────────────────────────

class DashboardInsights(BaseModel):
    new_jobs_today: int
    applied_today: int
    apply_streak_days: int
    top_ats_sources: dict[str, int]
    top_companies: list[str]
    top_skills: list[str]
    claude_spend_today: float
    scrape_healthy: bool
