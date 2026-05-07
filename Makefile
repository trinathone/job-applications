.PHONY: help dev-deps-docker dev-deps-brew install migrate seed run-all test lint

PYTHON := python3
UV := uv

help:
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

dev-deps-docker: ## Start postgres + redis via docker-compose
	docker compose up -d db redis
	@echo "Waiting for postgres..."
	@until docker compose exec db pg_isready -U jam > /dev/null 2>&1; do sleep 1; done
	@echo "Postgres ready."

dev-deps-brew: ## Install postgres + redis via homebrew (no docker)
	brew install postgresql@16 redis
	brew services start postgresql@16
	brew services start redis
	createuser -s jam || true
	createdb -U jam jam || true

install: ## Install all Python + Node dependencies
	cd backend && $(UV) sync
	cd frontend && npm install

migrate: ## Run alembic migrations
	cd backend && $(UV) run alembic upgrade head

migrate-down: ## Roll back last migration
	cd backend && $(UV) run alembic downgrade -1

seed: ## Load company seeds into database
	cd backend && $(UV) run python ../scripts/seed_db.py

run-all: ## Start all processes via honcho
	honcho start

run-api: ## Start FastAPI dev server only
	cd backend && $(UV) run uvicorn jam.api.main:app --reload --port 8000

run-worker: ## Start Celery worker
	cd backend && $(UV) run celery -A jam.tasks.celery_app worker --loglevel=info -Q default,scrape,enrich -c 4

run-beat: ## Start Celery beat scheduler
	cd backend && $(UV) run celery -A jam.tasks.celery_app beat --loglevel=info --scheduler redbeat.RedBeatScheduler

run-frontend: ## Start Vite dev server
	cd frontend && npm run dev

test: ## Run backend tests
	cd backend && $(UV) run pytest tests/ -v --tb=short

test-cov: ## Run tests with coverage
	cd backend && $(UV) run pytest tests/ --cov=jam --cov-report=term-missing

lint: ## Run linters
	cd backend && $(UV) run ruff check jam/ && $(UV) run ruff format --check jam/
	cd frontend && npm run lint

check-ats: ## Test all ATS endpoints
	cd backend && $(UV) run python ../scripts/check_ats_health.py

infra-up: ## Start full infra stack (db, redis, prometheus, grafana)
	docker compose up -d

infra-down: ## Stop infra stack
	docker compose down
