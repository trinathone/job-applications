# JAM — Job Aggregation Machine

A production-grade job board that scrapes software engineering jobs from multiple ATS platforms, deduplicates them, enriches them with AI-powered experience extraction, and serves them through a clean real-time feed — no account required to browse.

[![Frontend](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel)](https://vercel.com)
[![Backend](https://img.shields.io/badge/Backend-Render-46E3B7?logo=render)](https://render.com)
[![Database](https://img.shields.io/badge/Database-Supabase-3ECF8E?logo=supabase)](https://supabase.com)
[![Redis](https://img.shields.io/badge/Redis-Upstash-00C389?logo=redis)](https://upstash.com)

---

## What It Does

- **Aggregates jobs** from Greenhouse, Lever, Ashby, Adzuna, Reed, The Muse, LinkedIn, SerpAPI, and TheirStack
- **Deduplicates intelligently** using exact SHA-256 fingerprints (per-ATS) and soft cross-ATS matching
- **Extracts experience requirements** with a two-stage pipeline: regex first, Claude Haiku fallback
- **Streams jobs in real-time** over SSE so visitors see new results as they arrive
- **Tracks applications** for registered users with status, notes, and cover letter tailoring
- **Runs fully headless** — GitHub Actions triggers scrapes 3× daily, no laptop required

---

## Stack

| Layer | Tech |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Zustand, React Query, TailwindCSS |
| **Backend** | FastAPI, SQLAlchemy (async), Alembic, Pydantic v2 |
| **Database** | Supabase Postgres (asyncpg) |
| **Task Queue** | Celery + RedBeat (distributed scheduler) |
| **Cache / Broker** | Upstash Redis |
| **AI** | Anthropic Claude Haiku (YOE extraction, cover letter tailoring) |
| **Hosting** | Vercel (frontend), Render (backend) |
| **Monitoring** | Prometheus, Grafana, Sentry, structlog |
| **Automation** | GitHub Actions (cloud scrape trigger) |

---

## Architecture

```
Vercel (React SPA)
  └─→ Render (FastAPI + Celery)
        ├─→ Supabase Postgres   — jobs, users, applications, scrape logs
        ├─→ Upstash Redis       — Celery broker + SSE pub/sub
        └─→ Anthropic API       — YOE extraction, cover letter tailoring

GitHub Actions (cron: 7am / 11am / 4pm EST)
  └─→ POST /api/scrape/run (HMAC token)
        └─→ Celery scrape task
              └─→ ATS scrapers (parallel, rate-limited)
                    └─→ Dedup → Upsert → Publish to SSE
```

---

## Features

### Job Feed
- Keyset-paginated feed with real-time SSE streaming
- Filters: ATS source, remote/on-site, years of experience, date posted, US-only
- Skip manager — locally tracks jobs you've dismissed
- Job cards link directly to the original posting

### Scraping Pipeline
- **11 ATS sources**: Greenhouse, Lever, Ashby, Adzuna, Reed, The Muse, LinkedIn (Apify), SerpAPI, TheirStack
- **Two-tier deduplication**:
  - Tier 1: `SHA256(ats:slug:external_id)` — exact match per company
  - Tier 2: `SHA256(normalize(title + company))` — cross-ATS soft match
- **Per-ATS rate limiting** — token bucket with automatic backoff on 429s
- **Health tracking** — consecutive failure streaks, auto-pruning of dead companies
- **Error taxonomy** — DEAD, RATE_LIMITED, PARSE_ERROR, TIMEOUT classified per run

### YOE Enrichment
- **Stage 1 (Regex)**: 6 prioritized patterns, seniority detection, ~70% hit rate, zero cost
- **Stage 2 (Claude Haiku)**: LLM fallback for Stage 1 misses, batched up to 20 JDs per call
- **Daily budget cap**: $5 USD (configurable), tracked in Redis + Postgres, Prometheus gauges

### Application Tracking
- Idempotent UPSERT on `(user_id, job_id)` — safe to re-apply
- Statuses: saved → applied → interviewing → offered → rejected
- Notes field, applied date, response tracking
- AI cover letter tailoring with streaming output

### Authentication
- Email/password (register + login)
- Passwordless OTP (10-min expiry, 60-second rate limit)
- Google Sign-In (ID token verification)
- Invite codes (SHA-256 hashed, backend-only)

### Admin
- Visitor lead list, user list, scrape run logs
- Header-based auth (`X-Admin-Email`) + optional password second factor
- `/api/health` — DB, Redis, Celery component status

---

## Local Development

### Prerequisites

- Python 3.11+, [uv](https://github.com/astral-sh/uv)
- Node.js 18+, npm
- Docker (for local Postgres + Redis) — optional if you use hosted services

### 1. Clone & configure

```bash
git clone https://github.com/trinathone/JAM.git
cd JAM
cp .env.example backend/.env
# Fill in backend/.env — see Environment Variables below
```

### 2. Start local services (optional)

```bash
docker-compose up -d   # starts Postgres + Redis + Prometheus + Grafana
```

### 3. Backend

```bash
cd backend
uv sync
uv run alembic upgrade head          # run migrations
uv run python ../scripts/seed_db.py  # seed company list
uv run uvicorn jam.api.main:app --reload --port 8000
```

### 4. Celery worker + beat (optional, needed for scraping)

```bash
# In separate terminals from backend/
uv run celery -A jam.tasks.celery_app worker -Q scrape,enrich,default -l info
uv run celery -A jam.tasks.celery_app beat   -S redbeat.RedBeatScheduler -l info
```

### 5. Frontend

```bash
cd frontend
npm install
VITE_API_URL=http://127.0.0.1:8000/api npm run dev
```

Open **http://127.0.0.1:5173** — API docs at **http://127.0.0.1:8000/api/docs**

### Makefile shortcuts

```bash
make dev-deps-brew    # install Postgres + Redis via Homebrew
make install          # uv sync + npm install
make migrate          # alembic upgrade head
make seed             # seed company list
make run-api          # uvicorn
make run-worker       # celery worker
make run-beat         # celery beat
make run-all          # all processes via Procfile (requires honcho)
make test             # pytest
make test-cov         # pytest with coverage
make lint             # ruff + eslint
make check-ats        # health-check all ATS endpoints
```

---

## Environment Variables

### Backend (`backend/.env`)

```bash
# Database
DATABASE_URL=postgresql+asyncpg://user:pass@host/db
DATABASE_URL_SYNC=postgresql://user:pass@host/db   # Alembic only

# Redis
REDIS_URL=rediss://...
CELERY_BROKER_URL=rediss://...
CELERY_RESULT_BACKEND=rediss://...

# Auth
SECRET_KEY=<64 random hex chars>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=43200

# Admin
ADMIN_EMAILS=you@example.com
ADMIN_PANEL_PASSWORD=...              # optional second factor

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_DAILY_BUDGET_USD=5.00

# Scrape trigger (GitHub Actions)
SCRAPE_TRIGGER_TOKEN=<random secret>

# CORS
ALLOWED_ORIGINS=https://your-frontend.vercel.app

# Optional: third-party job APIs
ADZUNA_APP_ID=...
ADZUNA_APP_KEY=...
REED_API_KEY=...
THE_MUSE_API_KEY=...
APIFY_API_TOKEN=...
SERPAPI_KEY=...
THEIRSTACK_API_KEY=...

# Optional: observability
SENTRY_DSN=...
ENVIRONMENT=production
```

### Frontend (`frontend/.env`)

```bash
VITE_API_URL=https://your-backend.onrender.com/api
```

### GitHub repository secret

```bash
SCRAPE_TRIGGER_TOKEN=<same value as backend>
```

---

## Deployment

### Backend → Render

1. Connect your GitHub repo to a new Render **Web Service**
2. Set **Root directory**: `backend`
3. **Build command**: `pip install uv && uv sync`
4. **Start command**: `uv run uvicorn jam.api.main:app --host 0.0.0.0 --port $PORT`
5. Add all backend env vars in the Render dashboard
6. Add a second **Background Worker** for Celery: `uv run celery -A jam.tasks.celery_app worker -Q scrape,enrich,default -l info`

### Frontend → Vercel

1. Import repo into Vercel, set **Root directory**: `frontend`
2. Add `VITE_API_URL` environment variable pointing to your Render backend URL
3. Deploy — Vercel auto-builds on every push to `main`

### Scheduled Scraping → GitHub Actions

The workflow at [.github/workflows/cloud-scrape.yml](.github/workflows/cloud-scrape.yml) runs at **7 AM, 11 AM, and 4 PM EST** and calls `POST /api/scrape/run` with the `SCRAPE_TRIGGER_TOKEN`.

Enable it by adding `SCRAPE_TRIGGER_TOKEN` as a GitHub Actions secret (same value as your Render env var).

### Database Migrations

```bash
cd backend
uv run alembic upgrade head
```

Run this after every deploy that includes schema changes.

---

## API Overview

Base URL: `/api`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/jobs` | Paginated job feed with filters |
| `GET` | `/jobs/{id}` | Single job detail |
| `POST` | `/auth/register` | Email/password registration |
| `POST` | `/auth/login` | Email/password login |
| `POST` | `/auth/otp/request` | Request OTP code |
| `POST` | `/auth/otp/verify` | Verify OTP, return JWT |
| `POST` | `/auth/google` | Google Sign-In |
| `GET` | `/applications` | List user's applications |
| `POST` | `/applications` | Create / upsert application |
| `PATCH` | `/applications/{id}` | Update status, notes |
| `GET` | `/dashboard/stream` | SSE real-time job stream |
| `GET` | `/dashboard/insights` | Aggregated stats snapshot |
| `POST` | `/scrape/run` | Trigger scrape (token-protected) |
| `GET` | `/health` | Component health check |
| `GET` | `/metrics` | Prometheus metrics |

Full interactive docs: **`/api/docs`** (Swagger UI)

---

## Project Structure

```
JAM/
├── backend/
│   ├── jam/
│   │   ├── api/           # FastAPI routers (11 route modules)
│   │   ├── scrapers/      # ATS scrapers + pipeline + dedup
│   │   ├── tasks/         # Celery tasks + beat schedule
│   │   ├── enrichment/    # Regex YOE + Claude Haiku fallback
│   │   ├── monitoring/    # Prometheus metrics + Sentry
│   │   ├── models.py      # SQLAlchemy ORM (12 models)
│   │   ├── schemas.py     # Pydantic v2 schemas
│   │   ├── config.py      # Pydantic Settings
│   │   └── database.py    # Async engine + session factory
│   ├── alembic/           # DB migrations
│   └── tests/
├── frontend/
│   └── src/
│       └── App.tsx        # React SPA (routing, feed, filters)
├── infra/
│   ├── nginx/             # Reverse proxy config (SSE streaming)
│   └── prometheus/        # Scrape config
├── scripts/
│   ├── seed_db.py         # Load company seeds
│   ├── check_ats_health.py
│   └── backfill_fingerprints.py
├── .github/workflows/
│   └── cloud-scrape.yml   # Scheduled scrape trigger
├── docker-compose.yml     # Local dev services
├── Makefile
└── Procfile
```

---

## Monitoring

- **Prometheus** scrapes `/metrics` every 15s — 14 custom gauges/counters (scrape jobs, Claude spend, API latency, SSE connections, dedup rates)
- **Grafana** dashboards in `infra/grafana/dashboards/`
- **Sentry** captures exceptions when `SENTRY_DSN` is set
- **Structlog** provides structured JSON logs with context (`run_id`, `ats`, `slug`, `error_kind`)

---

## Scripts

```bash
# Seed the company list into Postgres
python scripts/seed_db.py

# Health-check all ATS endpoints (shows HTTP status for each)
python scripts/check_ats_health.py

# Backfill SHA-256 fingerprints for existing jobs
python scripts/backfill_fingerprints.py
```

---

## Contact

- **LinkedIn**: [linkedin.com/in/neverest](https://linkedin.com/in/neverest/)
- **Telegram**: [t.me/TNT3ME](https://t.me/TNT3ME)
- **Email**: trinath.connect@proton.me
