from pydantic import BaseModel, Field


class TrainingStartRequest(BaseModel):
    project_id: str
    dataset_id: str
    mode: str = Field(default="scratch", pattern="^(scratch|finetune)$")
    base_checkpoint: str | None = None
    batch_size: int = Field(default=4, ge=1, le=64)
    max_epochs: int = Field(default=10000, ge=10, le=100000)
    precision: str = Field(default="32", pattern="^(16-mixed|32|bf16-mixed)$")
    accumulate_grad_batches: int = Field(default=8, ge=1, le=32)
    espeak_voice: str = Field(default="uk")
    sample_rate: int = Field(default=22050)


class TrainingStatusResponse(BaseModel):
    active: bool
    run_id: str | None = None
    pid: int | None = None
    metrics: dict = {}
    log_lines: list[str] = []
    started_at: str | None = None
    elapsed_seconds: float = 0


class CheckpointInfo(BaseModel):
    path: str
    filename: str
    size_mb: float
    modified: str | None = None
