import io
import logging
import wave
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)


class SynthesisService:
    _voice = None
    _model_path = None

    @classmethod
    def get_voice(cls, onnx_path: str, config_path: str | None = None):
        """Завантажити або повернути кешовану модель."""
        if cls._voice is not None and cls._model_path == onnx_path:
            return cls._voice

        from piper import PiperVoice

        abs_onnx = Path(onnx_path)
        if not abs_onnx.is_absolute():
            abs_onnx = settings.storage_path / onnx_path

        abs_config = None
        if config_path:
            abs_config = Path(config_path)
            if not abs_config.is_absolute():
                abs_config = settings.storage_path / config_path

        logger.info(f"Loading voice: {abs_onnx}")
        cls._voice = PiperVoice.load(str(abs_onnx), str(abs_config) if abs_config else None)
        cls._model_path = onnx_path
        return cls._voice

    @classmethod
    def release(cls):
        cls._voice = None
        cls._model_path = None

    def synthesize(
        self,
        onnx_path: str,
        config_path: str | None,
        text: str,
        speaker_id: int | None = None,
        length_scale: float = 1.0,
        noise_scale: float = 0.667,
        noise_w: float = 0.8,
    ) -> bytes:
        """Синтезувати мовлення з тексту."""
        import tempfile
        from piper import SynthesisConfig

        voice = self.get_voice(onnx_path, config_path)

        synth_config = SynthesisConfig(
            speaker_id=speaker_id,
            length_scale=length_scale,
            noise_scale=noise_scale,
            noise_w_scale=noise_w,
        )

        # Use temp file because synthesize_wav needs a real wave.Wave_write
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name

        try:
            with wave.open(tmp_path, "wb") as wav_file:
                voice.synthesize_wav(text, wav_file, syn_config=synth_config)
            return Path(tmp_path).read_bytes()
        finally:
            Path(tmp_path).unlink(missing_ok=True)
