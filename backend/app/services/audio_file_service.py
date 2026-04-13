import shutil
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.audio_file import AudioFile


class AudioFileService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(
        self,
        project_id: str,
        filename: str,
        file_path: str,
        source_url: str | None = None,
        duration_sec: float | None = None,
        file_size_bytes: int | None = None,
    ) -> AudioFile:
        audio_file = AudioFile(
            project_id=project_id,
            filename=filename,
            file_path=file_path,
            source_url=source_url,
            duration_sec=duration_sec,
            file_size_bytes=file_size_bytes,
        )
        self.db.add(audio_file)
        await self.db.commit()
        await self.db.refresh(audio_file)
        return audio_file

    async def get_by_project(self, project_id: str) -> list[AudioFile]:
        result = await self.db.execute(
            select(AudioFile)
            .where(AudioFile.project_id == project_id)
            .order_by(AudioFile.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, audio_file_id: str) -> AudioFile | None:
        result = await self.db.execute(
            select(AudioFile).where(AudioFile.id == audio_file_id)
        )
        return result.scalar_one_or_none()

    async def delete(self, audio_file_id: str) -> bool:
        audio_file = await self.get_by_id(audio_file_id)
        if not audio_file:
            return False

        # Delete physical file
        abs_path = settings.storage_path / audio_file.file_path
        if abs_path.exists():
            abs_path.unlink()

        await self.db.delete(audio_file)
        await self.db.commit()
        return True

    async def save_uploaded_file(
        self,
        project_id: str,
        filename: str,
        content: bytes,
    ) -> AudioFile:
        """Зберегти завантажений файл користувача."""
        output_dir = settings.projects_path / project_id / "raw_audio"
        output_dir.mkdir(parents=True, exist_ok=True)

        file_path = output_dir / filename
        file_path.write_bytes(content)

        rel_path = str(file_path.relative_to(settings.storage_path))
        duration = self._get_duration(file_path)

        return await self.create(
            project_id=project_id,
            filename=filename,
            file_path=rel_path,
            duration_sec=duration,
            file_size_bytes=len(content),
        )

    def _get_duration(self, file_path: Path) -> float:
        import subprocess
        try:
            result = subprocess.run(
                [
                    "ffprobe", "-v", "quiet",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    str(file_path),
                ],
                capture_output=True, text=True, timeout=10,
            )
            return float(result.stdout.strip())
        except Exception:
            return 0.0
