"""Адаптер до piper1-gpl: побудова CLI команд для тренування та експорту."""

import json
import logging
import os
import re
import signal
import subprocess
import threading
from pathlib import Path
from typing import Callable

logger = logging.getLogger(__name__)

PIPER_GPL_PATH = os.environ.get("PIPER_GPL_PATH", "/opt/piper1-gpl")


class TrainingConfig:
    """Конфігурація тренування для RTX 3050."""

    def __init__(
        self,
        csv_path: str,
        audio_dir: str,
        cache_dir: str,
        config_path: str,
        espeak_voice: str = "uk",
        sample_rate: int = 22050,
        batch_size: int = 4,
        max_epochs: int = 10000,
        precision: str = "32",
        accumulate_grad_batches: int = 8,
        checkpoint_path: str | None = None,
        checkpoint_every_n_epochs: int = 500,
        log_dir: str | None = None,
    ):
        self.csv_path = csv_path
        self.audio_dir = audio_dir
        self.cache_dir = cache_dir
        self.config_path = config_path
        self.espeak_voice = espeak_voice
        self.sample_rate = sample_rate
        self.batch_size = batch_size
        self.max_epochs = max_epochs
        self.precision = precision
        self.accumulate_grad_batches = accumulate_grad_batches
        self.checkpoint_path = checkpoint_path
        self.checkpoint_every_n_epochs = checkpoint_every_n_epochs
        self.log_dir = log_dir


class PiperBridge:
    def build_training_command(self, config: TrainingConfig) -> list[str]:
        """Побудувати CLI команду для piper.train."""
        cmd = [
            "python3", "-m", "piper.train", "fit",
            "--data.voice_name", "custom",
            "--data.csv_path", config.csv_path,
            "--data.audio_dir", config.audio_dir,
            "--data.cache_dir", config.cache_dir,
            "--data.config_path", config.config_path,
            "--data.espeak_voice", config.espeak_voice,
            "--model.sample_rate", str(config.sample_rate),
            "--model.segment_size", "4096",
            "--data.batch_size", str(config.batch_size),
            "--trainer.max_epochs", str(config.max_epochs),
            "--trainer.precision", config.precision,
            "--trainer.accelerator", "gpu",
            "--trainer.devices", "1",
        ]

        # Checkpoint for fine-tuning
        if config.checkpoint_path:
            cmd.extend(["--ckpt_path", config.checkpoint_path])

        # Logging
        if config.log_dir:
            cmd.extend([
                "--trainer.default_root_dir", config.log_dir,
            ])

        return cmd

    def start_training(
        self,
        config: TrainingConfig,
        on_metrics: Callable[[dict], None] | None = None,
        on_log: Callable[[str], None] | None = None,
    ) -> subprocess.Popen:
        """Запустити тренування як subprocess."""
        cmd = self.build_training_command(config)
        logger.info(f"Starting training: {' '.join(cmd)}")

        env = os.environ.copy()
        env["PYTHONUNBUFFERED"] = "1"

        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env=env,
        )

        # Start monitor thread
        if on_metrics or on_log:
            monitor = threading.Thread(
                target=self._monitor_output,
                args=(process, on_metrics, on_log),
                daemon=True,
            )
            monitor.start()

        return process

    def _monitor_output(
        self,
        process: subprocess.Popen,
        on_metrics: Callable[[dict], None] | None,
        on_log: Callable[[str], None] | None,
    ):
        """Моніторинг stdout тренування, парсинг метрик."""
        for line in iter(process.stdout.readline, ""):
            line = line.strip()
            if not line:
                continue

            if on_log:
                on_log(line)

            if on_metrics:
                metrics = self._parse_metrics(line)
                if metrics:
                    on_metrics(metrics)

        process.wait()

    def _parse_metrics(self, line: str) -> dict | None:
        """Парсити метрики з виводу Lightning trainer."""
        # Lightning format: "Epoch X, global step Y: 'val/loss_g': Z, 'val/loss_d': W"
        # Or progress bar: "Epoch 0:  50%|... loss_g=12.34, loss_d=3.21"
        metrics = {}

        # Parse epoch
        epoch_match = re.search(r'[Ee]poch\s+(\d+)', line)
        if epoch_match:
            metrics["epoch"] = int(epoch_match.group(1))

        # Parse step
        step_match = re.search(r'(?:global.step|step)\s*[=:]\s*(\d+)', line, re.IGNORECASE)
        if step_match:
            metrics["step"] = int(step_match.group(1))

        # Parse losses
        for loss_name in ["loss_g", "loss_d", "loss_gen", "loss_disc", "loss"]:
            match = re.search(rf'{loss_name}\s*[=:]\s*([\d.]+)', line, re.IGNORECASE)
            if match:
                metrics[loss_name] = float(match.group(1))

        # Parse learning rate
        lr_match = re.search(r'lr\s*[=:]\s*([\d.eE+-]+)', line)
        if lr_match:
            metrics["lr"] = float(lr_match.group(1))

        return metrics if len(metrics) > 1 else None

    def stop_training(self, process: subprocess.Popen):
        """Зупинити тренування gracefully."""
        if process.poll() is None:
            logger.info("Stopping training (SIGTERM)...")
            process.send_signal(signal.SIGTERM)
            try:
                process.wait(timeout=30)
            except subprocess.TimeoutExpired:
                logger.warning("Training did not stop, killing...")
                process.kill()
                process.wait()

    def export_to_onnx(self, checkpoint_path: str, output_path: str) -> str:
        """Експортувати checkpoint в ONNX."""
        cmd = [
            "python3", "-m", "piper.train.export_onnx",
            "--checkpoint", checkpoint_path,
            "--output-file", output_path,
        ]
        logger.info(f"Exporting: {' '.join(cmd)}")
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            raise RuntimeError(f"Export failed: {result.stderr}")
        return output_path

    def synthesize(self, onnx_path: str, config_path: str, text: str) -> bytes:
        """Синтезувати мовлення з ONNX моделі."""
        from piper import PiperVoice
        import io
        import wave

        voice = PiperVoice.load(onnx_path, config_path)
        wav_buffer = io.BytesIO()
        with wave.open(wav_buffer, "wb") as wav:
            voice.synthesize(text, wav)
        return wav_buffer.getvalue()
