from datetime import datetime

from pydantic import BaseModel, Field


class YoutubeDownloadRequest(BaseModel):
    project_id: str
    url: str = Field(..., min_length=1)
    audio_format: str = Field(default="wav")


class YoutubeInfoResponse(BaseModel):
    title: str
    duration: int
    uploader: str
    thumbnail: str
    description: str


class AudioFileResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    source_url: str | None
    duration_sec: float | None
    file_path: str
    file_size_bytes: int | None
    created_at: datetime

    model_config = {"from_attributes": True}
