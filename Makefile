.PHONY: dev dev-backend dev-frontend install install-backend install-frontend \
       docker-up docker-down docker-build migrate test lint clean

# Development
dev:
	@echo "Starting backend and frontend in parallel..."
	$(MAKE) dev-backend & $(MAKE) dev-frontend & wait

dev-backend:
	cd backend && XDG_CURRENT_DESKTOP=GNOME DESKTOP_SESSION=gnome PATH="$$HOME/.deno/bin:$$PATH" uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend:
	cd frontend && npm run dev

dev-worker-gpu:
	cd backend && celery -A app.tasks worker -Q gpu --concurrency=1 -n gpu@%h --loglevel=info

dev-worker-cpu:
	cd backend && celery -A app.tasks worker -Q default --concurrency=2 -n cpu@%h --loglevel=info

# Installation
install: install-backend install-frontend

install-backend:
	cd backend && pip install -e ".[dev]"

install-frontend:
	cd frontend && npm install

# Database
migrate:
	cd backend && alembic upgrade head

migrate-new:
	cd backend && alembic revision --autogenerate -m "$(MSG)"

# Docker
docker-up:
	docker compose up -d

docker-down:
	docker compose down

docker-build:
	docker compose build

docker-logs:
	docker compose logs -f

# Testing
test:
	cd backend && pytest -v

test-cov:
	cd backend && pytest --cov=app --cov-report=html -v

# Utilities
lint:
	cd backend && ruff check app/ && ruff format --check app/

format:
	cd backend && ruff format app/

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf backend/.pytest_cache frontend/dist

export-cookies:
	cd backend && XDG_CURRENT_DESKTOP=GNOME DESKTOP_SESSION=gnome PATH="$$HOME/.deno/bin:$$PATH" \
	python3.11 -c "from app.services.youtube_service import YoutubeService; print('OK' if YoutubeService().ensure_cookies() else 'FAIL')"

gpu-status:
	nvidia-smi --query-gpu=name,memory.used,memory.total,temperature.gpu,utilization.gpu --format=csv
