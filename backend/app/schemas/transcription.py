from datetime import datetime

from pydantic import BaseModel, Field


class TranscriptionRequest(BaseModel):
    project_id: str
    audio_file_id: str
    model_size: str = Field(default="small", pattern="^(tiny|base|small|medium|large-v3)$")
    language: str | None = None


class SegmentResponse(BaseModel):
    id: str
    project_id: str
    audio_file_id: str
    start_time: float
    end_time: float
    text: str
    text_edited: bool
    included: bool
    created_at: datetime

    model_config = {"from_attributes": True}

    @property
    def duration_sec(self) -> float:
        return self.end_time - self.start_time


class SegmentUpdate(BaseModel):
    text: str | None = None
    included: bool | None = None


class MergeRequest(BaseModel):
    segment_ids: list[str] = Field(..., min_length=2)


class SplitRequest(BaseModel):
    split_time: float
