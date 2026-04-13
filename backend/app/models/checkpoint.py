import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Checkpoint(Base):
    __tablename__ = "checkpoints"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id: Mapped[str] = mapped_column(ForeignKey("training_runs.id", ondelete="CASCADE"))
    epoch: Mapped[int] = mapped_column(nullable=False)
    step: Mapped[int] = mapped_column(nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_size_bytes: Mapped[int | None] = mapped_column(nullable=True)
    loss_g: Mapped[float | None] = mapped_column(nullable=True)
    loss_d: Mapped[float | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)

    training_run = relationship("TrainingRun", back_populates="checkpoints")
