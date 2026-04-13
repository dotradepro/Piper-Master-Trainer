from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    language: str = Field(default="uk", max_length=10)
    espeak_voice: str = Field(default="uk", max_length=20)
    sample_rate: int = Field(default=22050)
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    language: str | None = Field(None, max_length=10)
    espeak_voice: str | None = Field(None, max_length=20)
    sample_rate: int | None = None
    description: str | None = None


class ProjectResponse(BaseModel):
    id: str
    name: str
    language: str
    espeak_voice: str
    sample_rate: int
    status: str
    description: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    id: str
    name: str
    language: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
