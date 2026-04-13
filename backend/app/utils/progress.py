"""In-memory progress tracking for long-running tasks."""

import threading
from datetime import datetime

_lock = threading.Lock()
_progress: dict[str, dict] = {}


def set_progress(task_id: str, progress: int, message: str = "", **extra):
    with _lock:
        _progress[task_id] = {
            "progress": min(100, max(0, progress)),
            "message": message,
            "updated_at": datetime.utcnow().isoformat(),
            **extra,
        }


def get_progress(task_id: str) -> dict | None:
    with _lock:
        return _progress.get(task_id)


def clear_progress(task_id: str):
    with _lock:
        _progress.pop(task_id, None)
