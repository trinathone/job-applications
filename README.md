# JAM — Job Applications Manager

JAM is a full-stack job search cockpit: it scrapes job sources, stores jobs, lets users review/apply/skip, tracks applications, scores jobs against a resume, and exposes admin views for users and scrape health.

## Stack

- Frontend: React, Vite, TypeScript, Zustand, React Query
- Backend: FastAPI, SQLAlchemy, Postgres, Redis, Celery
- Scraping: ATS scrapers plus external job APIs
- Auth: Google Sign-In, email OTP, password login, invite-code login

## Local Run

Start infra:

```bash
make dev-deps-docker
```

Run migrations and seed companies:

```bash
make migrate
make seed
```

Run backend:

```bash
make run-api
```

Run frontend:

```bash
make run-frontend
```

## Required Environment

Backend:

```text
DATABASE_URL=
DATABASE_URL_SYNC=
REDIS_URL=
CELERY_BROKER_URL=
CELERY_RESULT_BACKEND=
SECRET_KEY=
ALLOWED_ORIGINS=
GOOGLE_CLIENT_ID=
ADMIN_EMAILS=
ADMIN_PANEL_PASSWORD=
INVITE_CODE_HASHES=
```

Frontend:

```text
VITE_API_URL=
VITE_GOOGLE_CLIENT_ID=
```

## Deployment

Recommended production setup:

- Vercel for frontend
- Render or Railway for backend
- Supabase or Neon for Postgres
- Upstash or Railway Redis for Redis

The frontend must point to the permanent backend:

```text
VITE_API_URL=https://your-backend.example.com/api
```

## Support

- LinkedIn: https://linkedin.com/in/neverest/
- Telegram: https://t.me/TNT3ME
- Email: trinath.connect@proton.me
