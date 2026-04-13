from datetime import datetime

from pydantic import BaseModel, Field


class ExportRequest(BaseModel):
    project_id: str
    checkpoint_path: str


class ExportedModelResponse(BaseModel):
    id: str
    project_id: str
    checkpoint_id: str
    onnx_path: str
    config_path: str
    file_size_bytes: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SynthesizeRequest(BaseModel):
    model_id: str
    text: str = Field(..., min_length=1, max_length=5000)
    speaker_id: int | None = None
    length_scale: float = Field(default=1.0, ge=0.1, le=5.0)
    noise_scale: float = Field(default=0.667, ge=0.0, le=1.0)
    noise_w: float = Field(default=0.8, ge=0.0, le=1.0)
