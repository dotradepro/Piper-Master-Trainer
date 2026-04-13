from celery import Celery

from app.config import settings

celery_app = Celery(
    "piper_trainer",
    broker=settings.redis_url,
    backend=settings.redis_url.replace("/0", "/1"),
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    worker_concurrency=1,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    task_track_started=True,
    result_expires=86400,  # 24 hours
)

celery_app.conf.task_routes = {
    "app.tasks.youtube_tasks.*": {"queue": "default"},
    "app.tasks.transcription_tasks.*": {"queue": "gpu"},
    "app.tasks.dataset_tasks.*": {"queue": "gpu"},
    "app.tasks.training_tasks.*": {"queue": "gpu"},
    "app.tasks.export_tasks.*": {"queue": "gpu"},
}
