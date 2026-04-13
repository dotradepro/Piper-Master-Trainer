from app.tasks import celery_app


@celery_app.task(name="app.tasks.training_tasks.train_model", bind=True)
def train_model(self, run_id: str, config: dict):
    """Тренування VITS моделі - буде реалізовано у Фазі 5."""
    pass
