import gc
import logging
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class TranscriptionService:
    _model = None
    _model_size = None

    @classmethod
    def get_model(cls, model_size: str = "small", device: str = "auto"):
        """Завантажити або повернути кешовану модель Whisper."""
        if cls._model is not None and cls._model_size == model_size:
            return cls._model

        from faster_whisper import WhisperModel

        # Auto-detect device
        if device == "auto":
            device, compute_type = cls._detect_device()
        elif device == "cuda":
            compute_type = "float16"
        else:
            compute_type = "int8"

        logger.info(f"Loading Whisper model: {model_size} on {device} ({compute_type})")

        cls._model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
        )
        cls._model_size = model_size
        return cls._model

    @classmethod
    def _detect_device(cls) -> tuple[str, str]:
        """Визначити найкращий пристрій для Whisper."""
        try:
            import ctranslate2
            ctranslate2.get_supported_compute_types("cuda")
            return "cuda", "float16"
        except Exception:
            pass

        try:
            import torch
            if torch.cuda.is_available():
                return "cuda", "float16"
        except ImportError:
            pass

        return "cpu", "int8"

    @classmethod
    def release_model(cls):
        """Звільнити модель та GPU пам'ять."""
        cls._model = None
        cls._model_size = None
        gc.collect()
        try:
            import torch
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
        except ImportError:
            pass

    def transcribe(
        self,
        audio_path: str,
        language: str | None = None,
        model_size: str = "small",
        progress_callback=None,
    ) -> list[dict]:
        """Транскрибувати аудіо файл.

        Returns: список сегментів [{start, end, text}]
        """
        model = self.get_model(model_size)

        abs_path = Path(audio_path)
        if not abs_path.is_absolute():
            abs_path = settings.storage_path / audio_path

        logger.info(f"Transcribing: {abs_path}")

        segments_iter, info = model.transcribe(
            str(abs_path),
            language=language,
            beam_size=5,
            word_timestamps=True,
            vad_filter=True,
            vad_parameters=dict(
                min_silence_duration_ms=500,
                speech_pad_ms=200,
            ),
        )

        logger.info(f"Detected language: {info.language} (prob: {info.language_probability:.2f})")

        segments = []
        for i, seg in enumerate(segments_iter):
            segments.append({
                "start": round(seg.start, 3),
                "end": round(seg.end, 3),
                "text": seg.text.strip(),
            })
            if progress_callback:
                progress_callback(i + 1, seg.end)

        logger.info(f"Transcription complete: {len(segments)} segments")
        return segments
