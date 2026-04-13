"""Lightning callback that writes metrics to a JSON file for real-time monitoring."""

import json
import time
from pathlib import Path

from lightning.pytorch.callbacks import Callback


class MetricsFileCallback(Callback):
    """Пише метрики тренування в JSON файл після кожного step."""

    def __init__(self, metrics_path: str):
        super().__init__()
        self.metrics_path = Path(metrics_path)
        self.metrics_path.parent.mkdir(parents=True, exist_ok=True)
        self.step_count = 0
        self.epoch_start_time = 0.0
        self.training_start_time = 0.0

    def on_train_start(self, trainer, pl_module):
        self.training_start_time = time.time()
        self._write({"status": "starting", "epoch": 0, "step": 0})

    def on_train_epoch_start(self, trainer, pl_module):
        self.epoch_start_time = time.time()

    def on_train_batch_end(self, trainer, pl_module, outputs, batch, batch_idx):
        self.step_count += 1
        # Write every 10 steps to avoid IO overhead
        if self.step_count % 10 != 0:
            return

        epoch = trainer.current_epoch
        global_step = trainer.global_step
        max_epochs = trainer.max_epochs or 0

        # Get losses from logged metrics
        metrics = {}
        if hasattr(trainer, "callback_metrics"):
            for k, v in trainer.callback_metrics.items():
                try:
                    metrics[k] = float(v)
                except (TypeError, ValueError):
                    pass

        # Get losses from training step output
        if outputs is not None:
            if isinstance(outputs, dict):
                for k in ("loss", "loss_g", "loss_d"):
                    if k in outputs:
                        try:
                            metrics[k] = float(outputs[k])
                        except (TypeError, ValueError):
                            pass

        # Calculate progress
        steps_per_epoch = trainer.num_training_batches
        total_steps = max_epochs * steps_per_epoch if max_epochs and steps_per_epoch else 0
        progress = (global_step / total_steps * 100) if total_steps > 0 else 0

        elapsed = time.time() - self.training_start_time
        epoch_elapsed = time.time() - self.epoch_start_time

        # Estimate remaining time
        if global_step > 0 and total_steps > 0:
            steps_remaining = total_steps - global_step
            sec_per_step = elapsed / global_step
            eta_seconds = steps_remaining * sec_per_step
        else:
            eta_seconds = 0

        data = {
            "status": "training",
            "epoch": epoch,
            "max_epochs": max_epochs,
            "step": global_step,
            "steps_per_epoch": steps_per_epoch,
            "total_steps": total_steps,
            "progress": round(progress, 1),
            "elapsed_seconds": round(elapsed, 0),
            "eta_seconds": round(eta_seconds, 0),
            "epoch_elapsed_seconds": round(epoch_elapsed, 0),
            **metrics,
        }
        self._write(data)

    def on_train_epoch_end(self, trainer, pl_module):
        epoch = trainer.current_epoch
        max_epochs = trainer.max_epochs or 0
        global_step = trainer.global_step
        elapsed = time.time() - self.training_start_time

        metrics = {}
        if hasattr(trainer, "callback_metrics"):
            for k, v in trainer.callback_metrics.items():
                try:
                    metrics[k] = float(v)
                except (TypeError, ValueError):
                    pass

        steps_per_epoch = trainer.num_training_batches
        total_steps = max_epochs * steps_per_epoch if max_epochs and steps_per_epoch else 0
        progress = (global_step / total_steps * 100) if total_steps > 0 else 0

        self._write({
            "status": "training",
            "epoch": epoch,
            "max_epochs": max_epochs,
            "step": global_step,
            "steps_per_epoch": steps_per_epoch,
            "total_steps": total_steps,
            "progress": round(progress, 1),
            "elapsed_seconds": round(elapsed, 0),
            "eta_seconds": 0,
            "message": f"Epoch {epoch}/{max_epochs} завершено",
            **metrics,
        })

    def on_train_end(self, trainer, pl_module):
        self._write({"status": "completed", "epoch": trainer.current_epoch, "step": trainer.global_step})

    def _write(self, data: dict):
        try:
            self.metrics_path.write_text(json.dumps(data), encoding="utf-8")
        except Exception:
            pass
