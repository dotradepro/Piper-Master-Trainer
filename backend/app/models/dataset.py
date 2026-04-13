import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Dataset(Base):
    __tablename__ = "datasets"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    csv_path: Mapped[str] = mapped_column(Text, nullable=False)
    audio_dir: Mapped[str] = mapped_column(Text, nullable=False)
    total_segments: Mapped[int] = mapped_column(nullable=False)
    total_duration: Mapped[float] = mapped_column(nullable=False)
    config: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    project = relationship("Project", back_populates="datasets")
    training_runs = relationship("TrainingRun", back_populates="dataset")
