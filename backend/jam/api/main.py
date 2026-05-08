"""
FastAPI application factory.

Lifespan:
  - startup: init Sentry, warm DB connection pool
  - shutdown: close pool

CORS is open for localhost in dev; lock down in production via settings.allowed_origins.
"""
from __future__ import annotations

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from jam.api.middleware import PrometheusMiddleware
from jam.api.routers import applications, auth, dashboard, health, integrations, jobs, metrics, users
from jam.api.routers import scrape_control, visitors
from jam.api.routers import resume_builder, admin
from jam.config import settings
from jam.monitoring.sentry import init_sentry

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    # ── Startup ───────────────────────────────────────────────────────────────
    init_sentry()

    # Warm up the DB connection pool
    from jam.database import engine
    async with engine.connect() as conn:
        from sqlalchemy import text
        await conn.execute(text("SELECT 1"))

    # Create any new tables that aren't in the Alembic migration yet
    from jam.models import OtpCode, TailorSession, VisitorLead  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(TailorSession.__table__.create, checkfirst=True)
        await conn.run_sync(OtpCode.__table__.create, checkfirst=True)
        await conn.run_sync(VisitorLead.__table__.create, checkfirst=True)

    from jam.database import db_session
    from jam.seeds.loader import ensure_company_seeds

    async with db_session() as session:
        seed_count = await ensure_company_seeds(session)

    logger.info("company_seeds_ready", count=seed_count)
    logger.info("app_startup", environment=settings.environment)

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    await engine.dispose()
    logger.info("app_shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title="JA — Job Applications",
        description="Production-grade job aggregation and application tracking",
        version="0.1.0",
        docs_url="/api/docs" if not settings.is_production else None,
        redoc_url="/api/redoc" if not settings.is_production else None,
        lifespan=lifespan,
    )

    # ── Middleware ─────────────────────────────────────────────────────────────
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(PrometheusMiddleware)

    # ── Routers ────────────────────────────────────────────────────────────────
    app.include_router(auth.router)
    app.include_router(jobs.router)
    app.include_router(applications.router)
    app.include_router(dashboard.router)
    app.include_router(health.router)
    app.include_router(metrics.router)
    app.include_router(users.router)
    app.include_router(integrations.router)
    app.include_router(resume_builder.router)
    app.include_router(admin.router)
    app.include_router(visitors.router)
    app.include_router(scrape_control.router)

    return app


app = create_app()
