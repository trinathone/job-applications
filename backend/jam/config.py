"""
Central configuration — all env vars validated here via Pydantic Settings.
Every other module imports `settings` from this file; nothing reads os.environ directly.
"""
from __future__ import annotations

from datetime import datetime, timezone
from functools import lru_cache
from typing import Literal

from pydantic import Field, computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── App ───────────────────────────────────────────────────────────────────
    environment: Literal["development", "staging", "production"] = "development"
    secret_key: str = "change-me-in-production"

    @field_validator("secret_key", mode="after")
    @classmethod
    def _require_real_secret_in_prod(cls, v: str, info) -> str:
        env = (info.data or {}).get("environment", "development")
        if env == "production" and v == "change-me-in-production":
            raise ValueError(
                "SECRET_KEY must be set to a secure random value in production. "
                "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return v
    allowed_origins: list[str] = Field(
        default=["http://localhost:5173", "http://localhost:3000"],
        description="CORS allowed origins",
    )
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"

    # ── Database ──────────────────────────────────────────────────────────────
    database_url: str = "postgresql+asyncpg://jam:jam@localhost:5432/jam"
    database_url_sync: str = "postgresql://jam:jam@localhost:5432/jam"
    db_pool_size: int = 10
    db_max_overflow: int = 20
    db_pool_timeout: int = 30

    # ── Redis ─────────────────────────────────────────────────────────────────
    redis_url: str = "redis://localhost:6379/0"

    # ── Celery ────────────────────────────────────────────────────────────────
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "db+postgresql://jam:jam@localhost:5432/jam"

    # ── Claude / Anthropic ────────────────────────────────────────────────────
    anthropic_api_key: str = ""
    claude_daily_budget_usd: float = Field(default=5.00, ge=0.0)
    claude_extraction_model: str = "claude-haiku-4-5-20251001"

    # ── External API Keys ─────────────────────────────────────────────────────
    adzuna_app_id: str = ""
    adzuna_app_key: str = ""
    reed_api_key: str = ""
    the_muse_api_key: str = ""
    apify_token: str = ""
    apify_linkedin_actor_id: str = "hKByXkMQaC5Qt9UMN"
    serpapi_key: str = ""
    theirstack_api_key: str = ""

    # ── Admin ────────────────────────────────────────────────────────────────
    admin_emails: list[str] = Field(
        default=["sreenathomg@gmail.com"],
        description="Emails allowed to access /api/admin/*",
    )
    admin_panel_password: str = Field(
        default="",
        description="Optional second admin password required via X-Admin-Password.",
    )

    # ── Notifications ─────────────────────────────────────────────────────────
    telegram_bot_token: str = ""
    telegram_alert_chat_id: str = ""

    # ── OAuth & Email ──────────────────────────────────────────────────────────
    google_client_id: str = Field(default="", description="Google OAuth2 client ID (set GOOGLE_CLIENT_ID in .env)")
    smtp_host: str = Field(default="", description="SMTP server for OTP emails (e.g. smtp.gmail.com)")
    smtp_port: int = Field(default=587)
    smtp_user: str = Field(default="", description="SMTP login username")
    smtp_password: str = Field(default="", description="SMTP login password or app password")
    from_email: str = Field(default="", description="From address — defaults to smtp_user if blank")

    # ── Observability ─────────────────────────────────────────────────────────
    sentry_dsn: str = ""

    # ── Scraper behaviour ─────────────────────────────────────────────────────
    scraper_request_timeout: int = 15          # seconds per request
    scraper_max_concurrent: int = 50           # max simultaneous company fetches
    slug_stale_days: int = 30                  # days with 0 results → dormant
    slug_prune_days: int = 90                  # days dormant → eligible for pruning
    slug_fail_streak_threshold: int = 10       # consecutive fails → auto-inactive

    # ── Computed helpers (not env vars) ───────────────────────────────────────

    @computed_field
    @property
    def redis_spend_key_today(self) -> str:
        """Redis key for today's Claude spend counter."""
        today = datetime.now(tz=timezone.utc).strftime("%Y%m%d")
        return f"jam:claude_spend:{today}"

    @computed_field
    @property
    def is_production(self) -> bool:
        return self.environment == "production"

    @computed_field
    @property
    def sentry_enabled(self) -> bool:
        return bool(self.sentry_dsn)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


# Module-level singleton — import this everywhere
settings: Settings = get_settings()
