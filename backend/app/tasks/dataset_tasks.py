from app.tasks import celery_app


@celery_app.task(name="app.tasks.dataset_tasks.prepare_dataset", bind=True)
def prepare_dataset(self, project_id: str, config: dict):
    """Підготовка датасету - буде реалізовано у Фазі 4."""
    pass
