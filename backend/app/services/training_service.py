import gc
import json
import logging
import subprocess
import threading
import time
from datetime import datetime
from pathlib import Path

from app.config import settings
from app.utils.piper_bridge import PiperBridge, TrainingConfig

logger = logging.getLogger(__name__)


class TrainingProcess:
    """Контейнер для активного процесу тренування."""
    def __init__(self, run_id: str, process: subprocess.Popen, project_id: str = "", max_epochs: int = 0):
        self.run_id = run_id
        self.process = process
        self.project_id = project_id
        self.max_epochs = max_epochs
        self.metrics: dict = {}
        self.logs: list[str] = []
        self.started_at = datetime.utcnow()


# Singleton — один процес тренування одночасно
_active_training: TrainingProcess | None = None
_lock = threading.Lock()


class TrainingService:
    def start_training(
        self,
        run_id: str,
        project_id: str,
        dataset_id: str,
        csv_path: str,
        audio_dir: str,
        mode: str = "scratch",
        base_checkpoint: str | None = None,
        batch_size: int = 4,
        max_epochs: int = 10000,
        precision: str = "32",
        accumulate_grad_batches: int = 8,
        sample_rate: int = 22050,
        espeak_voice: str = "uk",
        on_metrics=None,
        on_log=None,
    ) -> subprocess.Popen:
        """Запустити тренування VITS моделі."""
        global _active_training

        with _lock:
            if _active_training and _active_training.process.poll() is None:
                raise RuntimeError("Тренування вже запущено. Зупиніть поточне перед запуском нового.")

        # Release GPU memory from previous tasks (whisper, etc.)
        self._cleanup_gpu()

        # Clean old checkpoints — keep only the latest one
        self._cleanup_old_checkpoints(project_id)

        project_dir = settings.projects_path / project_id
        cache_dir = project_dir / "cache"
        log_dir = project_dir / "logs"
        checkpoint_dir = project_dir / "checkpoints"
        cache_dir.mkdir(parents=True, exist_ok=True)
        log_dir.mkdir(parents=True, exist_ok=True)
        checkpoint_dir.mkdir(parents=True, exist_ok=True)

        # Config file for piper
        config_path = project_dir / "dataset" / "config.json"

        # Resolve paths
        abs_csv = settings.storage_path / csv_path
        abs_audio = settings.storage_path / audio_dir

        metrics_file = project_dir / "training_metrics.json"
        config = TrainingConfig(
            csv_path=str(abs_csv),
            audio_dir=str(abs_audio),
            cache_dir=str(cache_dir),
            config_path=str(config_path),
            espeak_voice=espeak_voice,
            sample_rate=sample_rate,
            batch_size=batch_size,
            max_epochs=max_epochs,
            precision=precision,
            accumulate_grad_batches=accumulate_grad_batches,
            checkpoint_path=base_checkpoint,
            log_dir=str(log_dir),
            metrics_path=str(metrics_file),
        )

        bridge = PiperBridge()

        def metrics_handler(m):
            if _active_training:
                _active_training.metrics.update(m)
            if on_metrics:
                on_metrics(m)

        def log_handler(line):
            if _active_training:
                _active_training.logs.append(line)
                if len(_active_training.logs) > 1000:
                    _active_training.logs = _active_training.logs[-500:]
            if on_log:
                on_log(line)

        process = bridge.start_training(config, metrics_handler, log_handler)

        with _lock:
            _active_training = TrainingProcess(run_id, process, project_id, max_epochs)

        logger.info(f"Training started: run={run_id}, pid={process.pid}")
        return process

    def stop_training(self, run_id: str) -> bool:
        global _active_training
        with _lock:
            if not _active_training or _active_training.run_id != run_id:
                return False
            bridge = PiperBridge()
            bridge.stop_training(_active_training.process)
            _active_training = None
            # Cleanup GPU
            try:
                import torch
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except ImportError:
                pass
            gc.collect()
            return True

    def get_status(self) -> dict:
        if not _active_training:
            return {"active": False}

        is_running = _active_training.process.poll() is None

        # Read progress from checkpoint files
        progress = self._read_training_progress()
        if progress:
            _active_training.metrics.update(progress)

        return {
            "active": is_running,
            "run_id": _active_training.run_id,
            "pid": _active_training.process.pid,
            "metrics": _active_training.metrics,
            "log_lines": _active_training.logs[-50:],
            "started_at": _active_training.started_at.isoformat(),
            "elapsed_seconds": (datetime.utcnow() - _active_training.started_at).total_seconds(),
        }

    def _read_training_progress(self) -> dict | None:
        """Читання прогресу з checkpoint файлів (epoch з назви)."""
        import re
        if not _active_training:
            return None
        try:
            project_dir = settings.projects_path / _active_training.project_id
            checkpoints = list(project_dir.rglob("*.ckpt"))
            if not checkpoints:
                return {"status": "preparing", "message": "Підготовка даних..."}

            # Find latest checkpoint by mtime
            latest = max(checkpoints, key=lambda p: p.stat().st_mtime)
            # Parse epoch and step from filename: epoch=120-step=74294.ckpt
            match = re.search(r'epoch=(\d+)-step=(\d+)', latest.name)
            if match:
                epoch = int(match.group(1))
                step = int(match.group(2))
                max_ep = _active_training.max_epochs or 10000
                progress = (epoch / max_ep) * 100 if max_ep > 0 else 0
                elapsed = (datetime.utcnow() - _active_training.started_at).total_seconds()
                eta = (elapsed / max(epoch, 1)) * (max_ep - epoch) if epoch > 0 else 0
                return {
                    "epoch": epoch,
                    "step": step,
                    "max_epochs": max_ep,
                    "progress": round(min(progress, 99.9), 1),
                    "elapsed_seconds": round(elapsed),
                    "eta_seconds": round(eta),
                    "status": "training",
                }
        except Exception:
            pass
        return None

    def get_logs(self, last_n: int = 100) -> list[str]:
        if not _active_training:
            return []
        return _active_training.logs[-last_n:]

    def list_checkpoints(self, project_id: str) -> list[dict]:
        """Список чекпоінтів проєкту."""
        ckpt_dirs = [
            settings.projects_path / project_id / "checkpoints",
            settings.projects_path / project_id / "logs",
        ]
        checkpoints = []
        for d in ckpt_dirs:
            if not d.exists():
                continue
            for f in d.rglob("*.ckpt"):
                checkpoints.append({
                    "path": str(f),
                    "filename": f.name,
                    "size_mb": f.stat().st_size / 1024 / 1024,
                    "modified": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
                })
        checkpoints.sort(key=lambda x: x["modified"], reverse=True)
        return checkpoints

    def _cleanup_old_checkpoints(self, project_id: str):
        """Видалити старі checkpoints, залишити тільки останній."""
        import shutil
        logs_dir = settings.projects_path / project_id / "logs" / "lightning_logs"
        if not logs_dir.exists():
            return
        # Find all version dirs
        versions = sorted(logs_dir.glob("version_*"), key=lambda p: p.stat().st_mtime)
        if len(versions) <= 1:
            return
        # Keep only the latest version
        for old_ver in versions[:-1]:
            logger.info(f"Removing old checkpoint dir: {old_ver}")
            shutil.rmtree(old_ver, ignore_errors=True)

    def _cleanup_gpu(self):
        """Звільнити GPU пам'ять від попередніх задач."""
        try:
            # Release cached whisper model
            from app.services.transcription_service import TranscriptionService
            TranscriptionService.release_model()
        except Exception:
            pass
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass
        gc.collect()
        logger.info("GPU memory cleaned up")

    def list_pretrained(self) -> list[dict]:
        """Список претренованих чекпоінтів."""
        pretrained_dir = settings.pretrained_path
        if not pretrained_dir.exists():
            return []
        result = []
        for f in pretrained_dir.glob("*.ckpt"):
            result.append({
                "path": str(f),
                "filename": f.name,
                "size_mb": f.stat().st_size / 1024 / 1024,
            })
        return result
