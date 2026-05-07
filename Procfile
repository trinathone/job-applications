api: uvicorn jam.api.main:app --host 0.0.0.0 --port 8000 --reload
worker: celery -A jam.tasks.celery_app worker --loglevel=info -Q default,scrape,enrich -c 4
beat: celery -A jam.tasks.celery_app beat --loglevel=info --scheduler redbeat.RedBeatScheduler
frontend: cd frontend && npm run dev
