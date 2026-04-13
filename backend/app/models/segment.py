import uuid
from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Segment(Base):
    __tablename__ = "segments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    audio_file_id: Mapped[str] = mapped_column(ForeignKey("audio_files.id", ondelete="CASCADE"))
    start_time: Mapped[float] = mapped_column(nullable=False)
    end_time: Mapped[float] = mapped_column(nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    text_edited: Mapped[bool] = mapped_column(Boolean, default=False)
    segment_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    included: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    project = relationship("Project", back_populates="segments")
    audio_file = relationship("AudioFile", back_populates="segments")

    @property
    def duration_sec(self) -> float:
        return self.end_time - self.start_time
