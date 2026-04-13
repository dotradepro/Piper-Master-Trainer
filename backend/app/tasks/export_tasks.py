from app.tasks import celery_app


@celery_app.task(name="app.tasks.export_tasks.export_onnx", bind=True)
def export_onnx(self, project_id: str, checkpoint_path: str, output_path: str):
    """Експорт моделі в ONNX формат - буде реалізовано у Фазі 6."""
    pass
