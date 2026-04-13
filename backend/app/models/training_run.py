import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TrainingRun(Base):
    __tablename__ = "training_runs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"))
    dataset_id: Mapped[str] = mapped_column(ForeignKey("datasets.id"))
    mode: Mapped[str] = mapped_column(String(20), nullable=False)  # scratch | finetune
    base_checkpoint: Mapped[str | None] = mapped_column(Text, nullable=True)
    config: Mapped[str] = mapped_column(Text, nullable=False)  # JSON
    status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    celery_task_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    current_epoch: Mapped[int] = mapped_column(default=0)
    current_step: Mapped[int] = mapped_column(default=0)
    last_loss_g: Mapped[float | None] = mapped_column(nullable=True)
    last_loss_d: Mapped[float | None] = mapped_column(nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    project = relationship("Project", back_populates="training_runs")
    dataset = relationship("Dataset", back_populates="training_runs")
    checkpoints = relationship("Checkpoint", back_populates="training_run", cascade="all, delete-orphan")
