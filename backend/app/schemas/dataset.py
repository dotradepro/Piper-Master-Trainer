from datetime import datetime

from pydantic import BaseModel, Field


class DatasetPrepareRequest(BaseModel):
    project_id: str
    min_duration: float = Field(default=1.0, ge=0.5, le=10.0)
    max_duration: float = Field(default=15.0, ge=2.0, le=30.0)
    sample_rate: int = Field(default=22050)


class DatasetResponse(BaseModel):
    id: str
    project_id: str
    csv_path: str
    audio_dir: str
    total_segments: int
    total_duration: float
    config: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class DatasetStatsResponse(BaseModel):
    total_segments: int
    total_duration_sec: float = 0
    avg_duration_sec: float = 0
    min_duration_sec: float = 0
    max_duration_sec: float = 0
    avg_text_length: float = 0
    duration_histogram: list[dict] = []


class ValidationIssue(BaseModel):
    level: str
    message: str
