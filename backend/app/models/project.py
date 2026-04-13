import uuid
from datetime import datetime

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    language: Mapped[str] = mapped_column(String(10), nullable=False, default="uk")
    espeak_voice: Mapped[str] = mapped_column(String(20), nullable=False, default="uk")
    sample_rate: Mapped[int] = mapped_column(nullable=False, default=22050)
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="created")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    audio_files = relationship("AudioFile", back_populates="project", cascade="all, delete-orphan")
    segments = relationship("Segment", back_populates="project", cascade="all, delete-orphan")
    datasets = relationship("Dataset", back_populates="project", cascade="all, delete-orphan")
    training_runs = relationship(
        "TrainingRun", back_populates="project", cascade="all, delete-orphan"
    )
    exported_models = relationship(
        "ExportedModel", back_populates="project", cascade="all, delete-orphan"
    )
