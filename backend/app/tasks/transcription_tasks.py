from app.tasks import celery_app


@celery_app.task(name="app.tasks.transcription_tasks.transcribe_audio", bind=True)
def transcribe_audio(self, project_id: str, audio_file_id: str, model_size: str = "small"):
    """Транскрипція аудіо через faster-whisper - буде реалізовано у Фазі 3."""
    pass
