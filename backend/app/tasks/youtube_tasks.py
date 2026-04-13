from app.tasks import celery_app


@celery_app.task(name="app.tasks.youtube_tasks.download_audio", bind=True)
def download_audio(self, project_id: str, url: str, audio_format: str = "wav"):
    """Завантаження аудіо з YouTube - буде реалізовано у Фазі 2."""
    pass
