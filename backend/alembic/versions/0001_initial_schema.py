"""Initial schema — all core tables

Revision ID: 0001
Revises:
Create Date: 2026-05-06
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── companies ─────────────────────────────────────────────────────────────
    op.create_table(
        "companies",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("name", sa.String(300), nullable=False),
        sa.Column("ats", sa.String(50), nullable=False),
        sa.Column("career_url", sa.Text(), nullable=True),
        sa.Column("active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("consecutive_fails", sa.Integer(), server_default="0", nullable=False),
        sa.Column("last_success_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_fail_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("pruned_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_index("idx_companies_ats", "companies", ["ats"])
    op.create_index(
        "idx_companies_active", "companies", ["active"],
        postgresql_where=sa.text("active = true"),
    )

    # ── users ─────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("display_name", sa.String(200), nullable=True),
        sa.Column("hashed_password", sa.String(200), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("email"),
    )

    # ── jobs ──────────────────────────────────────────────────────────────────
    op.create_table(
        "jobs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("fingerprint", sa.String(64), nullable=False),
        sa.Column("soft_key", sa.String(64), nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("external_id", sa.String(300), nullable=False),
        sa.Column("ats", sa.String(50), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("title_normalized", sa.String(500), nullable=False),
        sa.Column("location", sa.String(300), nullable=True),
        sa.Column("remote", sa.Boolean(), nullable=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("description_raw", sa.Text(), nullable=True),
        sa.Column("yoe_min", sa.SmallInteger(), nullable=True),
        sa.Column("yoe_max", sa.SmallInteger(), nullable=True),
        sa.Column("yoe_source", sa.String(10), nullable=True),
        sa.Column("salary_min", sa.Integer(), nullable=True),
        sa.Column("salary_max", sa.Integer(), nullable=True),
        sa.Column("posted_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("scraped_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("enriched_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("last_seen", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("is_dead", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("dead_confirmed_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("is_duplicate", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("extraction_raw", sa.Text(), nullable=True),
        sa.Column("extraction_prompt_ver", sa.String(10), nullable=True),
        sa.Column("needs_extraction", sa.Boolean(), server_default="false", nullable=False),
        sa.CheckConstraint("yoe_min >= 0 AND yoe_min <= 20", name="ck_yoe_min"),
        sa.CheckConstraint("yoe_max >= 0 AND yoe_max <= 25", name="ck_yoe_max"),
        sa.CheckConstraint("yoe_source IN ('regex', 'llm', 'manual', 'none')", name="ck_yoe_source"),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("fingerprint"),
        sa.UniqueConstraint("ats", "company_id", "external_id", name="uq_jobs_ats_external"),
    )
    op.create_index("idx_jobs_company", "jobs", ["company_id"])
    op.create_index("idx_jobs_scraped", "jobs", ["scraped_at"])
    op.create_index("idx_jobs_soft_key", "jobs", ["soft_key"])
    op.create_index(
        "idx_jobs_live", "jobs", ["scraped_at"],
        postgresql_where=sa.text("is_dead = false"),
    )
    op.create_index(
        "idx_jobs_enrichment", "jobs", ["enriched_at"],
        postgresql_where=sa.text("enriched_at IS NULL"),
    )

    # ── applications ──────────────────────────────────────────────────────────
    op.create_table(
        "applications",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("job_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), server_default="saved", nullable=False),
        sa.Column("skip_reason", sa.String(100), nullable=True),
        sa.Column("applied_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("session_date", sa.Date(), server_default=sa.text("current_date"), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("cover_letter", sa.Text(), nullable=True),
        sa.Column("got_response", sa.Boolean(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('saved','applied','interviewing','offer','rejected','archived','skipped')",
            name="ck_application_status",
        ),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("job_id", "user_id", name="uq_applications_job_user"),
    )
    op.create_index("idx_applications_user", "applications", ["user_id"])
    op.create_index("idx_applications_status", "applications", ["user_id", "status"])

    # ── scrape_runs ───────────────────────────────────────────────────────────
    op.create_table(
        "scrape_runs",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=True),
        sa.Column("ats", sa.String(50), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False),
        sa.Column("task_id", sa.String(200), nullable=True),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("finished_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("status", sa.String(20), server_default="running", nullable=False),
        sa.Column("jobs_found", sa.Integer(), server_default="0"),
        sa.Column("jobs_new", sa.Integer(), server_default="0"),
        sa.Column("jobs_updated", sa.Integer(), server_default="0"),
        sa.Column("jobs_dead", sa.Integer(), server_default="0"),
        sa.Column("error_kind", sa.String(30), nullable=True),
        sa.Column("error_detail", sa.Text(), nullable=True),
        sa.Column("http_status", sa.SmallInteger(), nullable=True),
        sa.Column("duration_ms", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("idx_scrape_runs_company", "scrape_runs", ["company_id", "started_at"])
    op.create_index("idx_scrape_runs_status", "scrape_runs", ["status", "started_at"])
    op.create_index("idx_scrape_runs_task", "scrape_runs", ["task_id"])

    # ── slug_health ───────────────────────────────────────────────────────────
    op.create_table(
        "slug_health",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("company_id", sa.Integer(), nullable=False),
        sa.Column("total_runs", sa.Integer(), server_default="0", nullable=False),
        sa.Column("success_runs", sa.Integer(), server_default="0", nullable=False),
        sa.Column("fail_streak", sa.SmallInteger(), server_default="0", nullable=False),
        sa.Column("last_checked_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("health_score", sa.Numeric(4, 3), nullable=True),
        sa.Column("auto_pruned", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("pruned_at", sa.TIMESTAMP(timezone=True), nullable=True),
        sa.Column("updated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["company_id"], ["companies.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("company_id"),
    )

    # ── claude_spend_log ──────────────────────────────────────────────────────
    op.create_table(
        "claude_spend_log",
        sa.Column("id", sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column("job_id", sa.BigInteger(), nullable=True),
        sa.Column("model", sa.String(100), nullable=False),
        sa.Column("input_tokens", sa.Integer(), nullable=False),
        sa.Column("output_tokens", sa.Integer(), nullable=False),
        sa.Column("cost_usd", sa.Numeric(10, 6), nullable=False),
        sa.Column("purpose", sa.String(50), nullable=False),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_claude_spend_created", "claude_spend_log",
        ["created_at"],
    )

    # ── weekly_digests ────────────────────────────────────────────────────────
    op.create_table(
        "weekly_digests",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("week_start", sa.Date(), nullable=False),
        sa.Column("jobs_scraped", sa.Integer(), nullable=True),
        sa.Column("jobs_applied", sa.Integer(), nullable=True),
        sa.Column("applications_json", postgresql.JSONB(), nullable=True),
        sa.Column("generated_at", sa.TIMESTAMP(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "week_start", name="uq_weekly_digests_user_week"),
    )


def downgrade() -> None:
    op.drop_table("weekly_digests")
    op.drop_table("claude_spend_log")
    op.drop_table("slug_health")
    op.drop_table("scrape_runs")
    op.drop_table("applications")
    op.drop_table("jobs")
    op.drop_table("users")
    op.drop_table("companies")
