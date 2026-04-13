import json
import logging
import shutil
import subprocess
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.exported_model import ExportedModel

logger = logging.getLogger(__name__)


class ExportService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def export_onnx(
        self,
        project_id: str,
        checkpoint_path: str,
    ) -> ExportedModel:
        """Експортувати checkpoint в ONNX формат для Piper."""
        ckpt = Path(checkpoint_path)
        if not ckpt.exists():
            raise FileNotFoundError(f"Checkpoint не знайдено: {checkpoint_path}")

        exports_dir = settings.projects_path / project_id / "exports"
        exports_dir.mkdir(parents=True, exist_ok=True)

        # Output paths
        model_name = ckpt.stem.replace("=", "_")
        onnx_path = exports_dir / f"{model_name}.onnx"
        config_path = exports_dir / f"{model_name}.onnx.json"

        # Run piper export
        cmd = [
            "python3", "-m", "piper.train.export_onnx",
            "--checkpoint", str(ckpt),
            "--output-file", str(onnx_path),
        ]
        logger.info(f"Exporting: {' '.join(cmd)}")

        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,
        )

        if result.returncode != 0:
            error_msg = result.stderr[-500:] if result.stderr else "Unknown error"
            raise RuntimeError(f"Export failed: {error_msg}")

        if not onnx_path.exists():
            raise RuntimeError("ONNX файл не створено")

        # Copy/create config
        dataset_config = settings.projects_path / project_id / "dataset" / "config.json"
        if dataset_config.exists():
            shutil.copy2(dataset_config, config_path)
        else:
            # Create minimal config
            config_data = {
                "audio": {"sample_rate": 22050},
                "espeak": {"voice": "uk"},
                "inference": {
                    "noise_scale": 0.667,
                    "length_scale": 1.0,
                    "noise_w": 0.8,
                },
                "num_speakers": 0,
                "phoneme_type": "espeak",
            }
            config_path.write_text(
                json.dumps(config_data, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )

        # Save to DB
        model = ExportedModel(
            project_id=project_id,
            checkpoint_id=ckpt.stem,
            onnx_path=str(onnx_path.relative_to(settings.storage_path)),
            config_path=str(config_path.relative_to(settings.storage_path)),
            file_size_bytes=onnx_path.stat().st_size,
        )
        self.db.add(model)
        await self.db.commit()
        await self.db.refresh(model)

        logger.info(f"Exported: {onnx_path} ({model.file_size_bytes / 1024 / 1024:.1f} MB)")
        return model

    async def get_by_project(self, project_id: str) -> list[ExportedModel]:
        result = await self.db.execute(
            select(ExportedModel)
            .where(ExportedModel.project_id == project_id)
            .order_by(ExportedModel.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, model_id: str) -> ExportedModel | None:
        result = await self.db.execute(
            select(ExportedModel).where(ExportedModel.id == model_id)
        )
        return result.scalar_one_or_none()
