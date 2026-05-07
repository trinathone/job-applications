"""
SQLAlchemy ORM models — single source of truth for all table definitions.
Constraints mirror the SQL schema exactly; Alembic generates migrations from these.
"""
from __future__ import annotations

from datetime import datetime, date
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import TIMESTAMP

from jam.database import Base


# ── Helpers ───────────────────────────────────────────────────────────────────

def now_utc():
    return func.now()


# ── Company ───────────────────────────────────────────────────────────────────

class Company(Base):
    __tablename__ = "companies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    slug: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(300), nullable=False)
    ats: Mapped[str] = mapped_column(String(50), nullable=False)  # greenhouse|lever|ashby|...
    career_url: Mapped[Optional[str]] = mapped_column(Text)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    consecutive_fails: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    last_success_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    last_fail_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    pruned_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    jobs: Mapped[list["Job"]] = relationship("Job", back_populates="company", lazy="noload")
    slug_health: Mapped[Optional["SlugHealth"]] = relationship(
        "SlugHealth", back_populates="company", uselist=False, lazy="noload"
    )

    __table_args__ = (
        Index("idx_companies_ats", "ats"),
        Index("idx_companies_active", "active", postgresql_where="active = true"),
    )


# ── Job ───────────────────────────────────────────────────────────────────────

class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # Deduplication
    fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    soft_key: Mapped[str] = mapped_column(String(64), nullable=False)

    # Source
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False
    )
    external_id: Mapped[str] = mapped_column(String(300), nullable=False)
    ats: Mapped[str] = mapped_column(String(50), nullable=False)

    # Core fields
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    title_normalized: Mapped[str] = mapped_column(String(500), nullable=False)
    location: Mapped[Optional[str]] = mapped_column(String(300))
    remote: Mapped[Optional[bool]] = mapped_column(Boolean)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    description_raw: Mapped[Optional[str]] = mapped_column(Text)

    # Experience extraction
    yoe_min: Mapped[Optional[int]] = mapped_column(
        SmallInteger,
        CheckConstraint("yoe_min >= 0 AND yoe_min <= 20", name="ck_yoe_min"),
    )
    yoe_max: Mapped[Optional[int]] = mapped_column(
        SmallInteger,
        CheckConstraint("yoe_max >= 0 AND yoe_max <= 25", name="ck_yoe_max"),
    )
    yoe_source: Mapped[Optional[str]] = mapped_column(
        String(10),
        CheckConstraint("yoe_source IN ('regex', 'llm', 'manual', 'none')", name="ck_yoe_source"),
    )

    # Compensation
    salary_min: Mapped[Optional[int]] = mapped_column(Integer)
    salary_max: Mapped[Optional[int]] = mapped_column(Integer)

    # Lifecycle
    posted_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    scraped_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    enriched_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    last_seen: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    is_dead: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    dead_confirmed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    is_duplicate: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    # LLM audit
    extraction_raw: Mapped[Optional[str]] = mapped_column(Text)
    extraction_prompt_ver: Mapped[Optional[str]] = mapped_column(String(10))
    needs_extraction: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")

    company: Mapped["Company"] = relationship("Company", back_populates="jobs", lazy="noload")
    applications: Mapped[list["Application"]] = relationship(
        "Application", back_populates="job", lazy="noload"
    )

    __table_args__ = (
        UniqueConstraint("ats", "company_id", "external_id", name="uq_jobs_ats_external"),
        Index("idx_jobs_company", "company_id"),
        Index("idx_jobs_scraped", "scraped_at"),
        Index("idx_jobs_soft_key", "soft_key"),
        Index("idx_jobs_live", "scraped_at", postgresql_where="is_dead = false"),
        Index("idx_jobs_enrichment", "enriched_at", postgresql_where="enriched_at IS NULL"),
    )


# ── User ──────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, unique=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(200))
    hashed_password: Mapped[str] = mapped_column(String(200), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    applications: Mapped[list["Application"]] = relationship(
        "Application", back_populates="user", lazy="noload"
    )


# ── Application ───────────────────────────────────────────────────────────────

APPLICATION_STATUSES = ("saved", "applied", "interviewing", "offer", "rejected", "archived", "skipped")

class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="saved",
        server_default="saved",
    )
    skip_reason: Mapped[Optional[str]] = mapped_column(String(100))
    applied_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    session_date: Mapped[date] = mapped_column(Date, nullable=False, server_default=func.current_date())
    notes: Mapped[Optional[str]] = mapped_column(Text)
    cover_letter: Mapped[Optional[str]] = mapped_column(Text)  # tailored cover letter text
    got_response: Mapped[Optional[bool]] = mapped_column(Boolean)  # NULL = not yet known
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    job: Mapped["Job"] = relationship("Job", back_populates="applications", lazy="noload")
    user: Mapped["User"] = relationship("User", back_populates="applications", lazy="noload")

    __table_args__ = (
        UniqueConstraint("job_id", "user_id", name="uq_applications_job_user"),
        CheckConstraint(
            f"status IN {APPLICATION_STATUSES!r}".replace("[", "(").replace("]", ")"),
            name="ck_application_status",
        ),
        Index("idx_applications_user", "user_id"),
        Index("idx_applications_status", "user_id", "status"),
    )


# ── Scrape Run ────────────────────────────────────────────────────────────────

class ScrapeRun(Base):
    __tablename__ = "scrape_runs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    company_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="SET NULL")
    )
    ats: Mapped[str] = mapped_column(String(50), nullable=False)
    slug: Mapped[str] = mapped_column(String(200), nullable=False)
    task_id: Mapped[Optional[str]] = mapped_column(String(200))
    started_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )
    finished_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="running", server_default="running"
    )  # running|success|partial|failed|skipped
    jobs_found: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    jobs_new: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    jobs_updated: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    jobs_dead: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    error_kind: Mapped[Optional[str]] = mapped_column(String(30))
    error_detail: Mapped[Optional[str]] = mapped_column(Text)
    http_status: Mapped[Optional[int]] = mapped_column(SmallInteger)
    duration_ms: Mapped[Optional[int]] = mapped_column(Integer)

    __table_args__ = (
        Index("idx_scrape_runs_company", "company_id", "started_at"),
        Index("idx_scrape_runs_status", "status", "started_at"),
        Index("idx_scrape_runs_task", "task_id"),
    )


# ── Slug Health ───────────────────────────────────────────────────────────────

class SlugHealth(Base):
    __tablename__ = "slug_health"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("companies.id", ondelete="CASCADE"), nullable=False, unique=True
    )
    total_runs: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    success_runs: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    fail_streak: Mapped[int] = mapped_column(SmallInteger, nullable=False, default=0, server_default="0")
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    health_score: Mapped[Optional[Decimal]] = mapped_column(Numeric(4, 3))
    auto_pruned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    pruned_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )

    company: Mapped["Company"] = relationship("Company", back_populates="slug_health", lazy="noload")


# ── Claude Spend Log ──────────────────────────────────────────────────────────

class ClaudeSpendLog(Base):
    __tablename__ = "claude_spend_log"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    job_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("jobs.id", ondelete="SET NULL")
    )
    model: Mapped[str] = mapped_column(String(100), nullable=False, default="claude-haiku-4-5-20251001")
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False)
    cost_usd: Mapped[Decimal] = mapped_column(Numeric(10, 6), nullable=False)
    purpose: Mapped[str] = mapped_column(String(50), nullable=False)  # yoe_extraction|title_norm
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("idx_claude_spend_created", "created_at"),
    )


# ── Tailor Session ────────────────────────────────────────────────────────────
# Stores Claude-generated tailored content for a (user, job) pair.
# To use Supabase instead: just point DATABASE_URL in .env to your Supabase
# postgres connection string — schema is identical.

class TailorSession(Base):
    __tablename__ = "tailor_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    job_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "job_id", name="uq_tailor_sessions_user_job"),
        Index("idx_tailor_sessions_user", "user_id"),
    )


# ── Weekly Digest ─────────────────────────────────────────────────────────────

class WeeklyDigest(Base):
    __tablename__ = "weekly_digests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    week_start: Mapped[date] = mapped_column(Date, nullable=False)
    jobs_scraped: Mapped[Optional[int]] = mapped_column(Integer)
    jobs_applied: Mapped[Optional[int]] = mapped_column(Integer)
    applications_json: Mapped[Optional[dict]] = mapped_column(JSONB)
    generated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        UniqueConstraint("user_id", "week_start", name="uq_weekly_digests_user_week"),
    )


# ── OTP Code ──────────────────────────────────────────────────────────────────
# Single-use 6-digit codes for passwordless email sign-in.
# Created by POST /api/auth/otp/request, consumed by POST /api/auth/otp/verify.

class OtpCode(Base):
    __tablename__ = "otp_codes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, server_default=func.now()
    )

    __table_args__ = (
        Index("idx_otp_codes_email_created", "email", "created_at"),
    )
