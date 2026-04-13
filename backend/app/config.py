from pathlib import Path

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # App
    app_name: str = "Piper Master Trainer"
    debug: bool = True

    # Database
    database_url: str = "sqlite+aiosqlite:///./storage/db.sqlite3"

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Storage
    storage_path: Path = Path("./storage")

    # GPU
    cuda_visible_devices: str = "0"

    # Whisper
    whisper_model_size: str = "small"
    whisper_device: str = "cuda"
    whisper_compute_type: str = "float16"

    # Training defaults
    default_batch_size: int = 4
    default_precision: str = "16-mixed"
    default_accumulate_grad_batches: int = 8
    default_max_epochs: int = 10000
    default_sample_rate: int = 22050

    # Piper
    piper_gpl_path: str = "/opt/piper1-gpl"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    @property
    def projects_path(self) -> Path:
        return self.storage_path / "projects"

    @property
    def pretrained_path(self) -> Path:
        return self.storage_path / "pretrained"


settings = Settings()
