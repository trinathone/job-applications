# JA — Public Job Board

JA is a public job board that shows scraped software jobs without forcing users to create an account. Visitors enter only basic info, then go straight to the job feed.

## What It Does

- Shows live job data from the backend.
- Captures visitor name, email, and role: student, teacher, or other.
- Lets visitors browse, filter, open, skip, and mark jobs locally.
- Keeps admin tools locked behind admin credentials.
- Runs the backend in the cloud, so the app does not depend on a laptop.
- Exposes a cloud scrape trigger that can be called by GitHub Actions.

## Stack

- Frontend: React, Vite, TypeScript, Zustand, React Query
- Backend: FastAPI, SQLAlchemy, Postgres
- Database: Supabase Postgres
- Redis: Upstash Redis
- Hosting: Vercel frontend, Render backend
- Automation: GitHub Actions cloud scrape trigger

## Live Shape

```text
Vercel frontend
  -> Render FastAPI backend
    -> Supabase Postgres
    -> Upstash Redis

GitHub Actions, after workflow permission is enabled
  -> wakes Render backend
  -> calls /api/scrape/run once daily
```

## Local Run

Backend:

```bash
cd backend
uv run uvicorn jam.api.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm install
VITE_API_URL=http://127.0.0.1:8000/api npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

## Required Production Env

Render backend:

```text
DATABASE_URL=postgresql+asyncpg://...
DATABASE_URL_SYNC=postgresql://...
REDIS_URL=rediss://...
CELERY_BROKER_URL=rediss://...
CELERY_RESULT_BACKEND=rediss://...
SECRET_KEY=...
ALLOWED_ORIGINS=https://job-applications-gamma.vercel.app
ADMIN_EMAILS=sreenathomg@gmail.com
ADMIN_PANEL_PASSWORD=...
SCRAPE_TRIGGER_TOKEN=...
```

Vercel frontend:

```text
VITE_API_URL=https://job-applications-5m2m.onrender.com/api
```

GitHub repository secret:

```text
SCRAPE_TRIGGER_TOKEN=same-value-as-render
```

## Public Flow

1. Visitor opens the site.
2. Visitor enters name, email, and role.
3. The app stores that lead in the backend.
4. Visitor sees the job board immediately.

No Google login is required for normal visitors.

## Scraping

The backend exposes `POST /api/scrape/run`.

Use GitHub Actions to call it once daily at `12:00 UTC` after the repository token has workflow permission.

## Support

- LinkedIn: https://linkedin.com/in/neverest/
- Telegram: https://t.me/TNT3ME
- Email: trinath.connect@proton.me
