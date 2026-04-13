import json
import logging
import subprocess
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.dataset import Dataset
from app.models.segment import Segment

logger = logging.getLogger(__name__)


class DatasetService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def prepare(
        self,
        project_id: str,
        min_duration: float = 1.0,
        max_duration: float = 15.0,
        sample_rate: int = 22050,
    ) -> Dataset:
        """Підготувати датасет з сегментів: нарізка WAV, нормалізація, генерація CSV."""
        # Get included segments
        result = await self.db.execute(
            select(Segment)
            .where(Segment.project_id == project_id, Segment.included == True)
            .order_by(Segment.start_time)
        )
        segments = list(result.scalars().all())

        if not segments:
            raise ValueError("Немає включених сегментів для датасету")

        # Setup directories
        dataset_dir = settings.projects_path / project_id / "dataset"
        audio_dir = dataset_dir / "wavs"
        audio_dir.mkdir(parents=True, exist_ok=True)

        # Filter by duration
        valid_segments = [
            s for s in segments
            if min_duration <= (s.end_time - s.start_time) <= max_duration
            and s.text.strip()
        ]

        if not valid_segments:
            raise ValueError(
                f"Жоден сегмент не пройшов фільтр "
                f"(тривалість {min_duration}-{max_duration}с, непорожній текст)"
            )

        logger.info(f"Preparing dataset: {len(valid_segments)}/{len(segments)} segments passed filter")

        # Extract and normalize audio segments
        csv_lines = []
        total_duration = 0.0

        for i, seg in enumerate(valid_segments):
            # Build source audio path
            from app.models.audio_file import AudioFile
            af_result = await self.db.execute(
                select(AudioFile).where(AudioFile.id == seg.audio_file_id)
            )
            audio_file = af_result.scalar_one_or_none()
            if not audio_file:
                continue

            source_path = settings.storage_path / audio_file.file_path
            if not source_path.exists():
                continue

            # Output filename
            utt_name = f"utt_{i:05d}"
            out_path = audio_dir / f"{utt_name}.wav"

            # Extract segment with ffmpeg: mono, target sample rate, normalized
            duration = seg.end_time - seg.start_time
            try:
                subprocess.run(
                    [
                        "ffmpeg", "-y",
                        "-ss", str(seg.start_time),  # seek BEFORE input for speed
                        "-i", str(source_path),
                        "-t", str(duration),
                        "-ar", str(sample_rate),
                        "-ac", "1",  # mono
                        "-acodec", "pcm_s16le",
                        str(out_path),
                    ],
                    capture_output=True,
                    timeout=60,
                    check=True,
                )
            except subprocess.CalledProcessError as e:
                logger.warning(f"Failed to extract segment {i}: {e.stderr[:200] if e.stderr else ''}")
                continue

            if not out_path.exists():
                continue

            # Update segment path
            seg.segment_path = str(out_path.relative_to(settings.storage_path))
            total_duration += duration

            # Piper CSV format: filename|text
            text = seg.text.strip().replace("|", " ")
            csv_lines.append(f"{utt_name}.wav|{text}")

        if not csv_lines:
            raise ValueError("Не вдалося підготувати жодного сегменту")

        # Write metadata.csv
        csv_path = dataset_dir / "metadata.csv"
        csv_path.write_text("\n".join(csv_lines) + "\n", encoding="utf-8")

        # Write config.json for piper
        config = {
            "audio": {"sample_rate": sample_rate},
            "espeak": {"voice": "uk"},
            "inference": {"noise_scale": 0.667, "length_scale": 1.0, "noise_w": 0.8},
            "num_speakers": 0,
            "phoneme_type": "espeak",
        }
        config_path = dataset_dir / "config.json"
        config_path.write_text(json.dumps(config, indent=2, ensure_ascii=False), encoding="utf-8")

        await self.db.commit()

        # Save dataset record
        dataset = Dataset(
            project_id=project_id,
            csv_path=str(csv_path.relative_to(settings.storage_path)),
            audio_dir=str(audio_dir.relative_to(settings.storage_path)),
            total_segments=len(csv_lines),
            total_duration=total_duration,
            config=json.dumps({
                "min_duration": min_duration,
                "max_duration": max_duration,
                "sample_rate": sample_rate,
                "original_segments": len(segments),
                "filtered_segments": len(valid_segments),
                "extracted_segments": len(csv_lines),
            }),
        )
        self.db.add(dataset)
        await self.db.commit()
        await self.db.refresh(dataset)

        logger.info(
            f"Dataset ready: {len(csv_lines)} segments, "
            f"{total_duration:.0f}s ({total_duration/60:.1f} min)"
        )

        return dataset

    async def get_by_project(self, project_id: str) -> list[Dataset]:
        result = await self.db.execute(
            select(Dataset)
            .where(Dataset.project_id == project_id)
            .order_by(Dataset.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_by_id(self, dataset_id: str) -> Dataset | None:
        result = await self.db.execute(
            select(Dataset).where(Dataset.id == dataset_id)
        )
        return result.scalar_one_or_none()

    async def get_stats(self, dataset_id: str) -> dict:
        """Статистика датасету."""
        dataset = await self.get_by_id(dataset_id)
        if not dataset:
            return {}

        csv_path = settings.storage_path / dataset.csv_path
        if not csv_path.exists():
            return {}

        lines = csv_path.read_text(encoding="utf-8").strip().split("\n")
        durations = []
        text_lengths = []

        audio_dir = settings.storage_path / dataset.audio_dir
        for line in lines:
            parts = line.split("|", 1)
            if len(parts) != 2:
                continue
            wav_name, text = parts
            text_lengths.append(len(text))

            wav_path = audio_dir / wav_name
            if wav_path.exists():
                dur = self._get_duration(wav_path)
                if dur > 0:
                    durations.append(dur)

        if not durations:
            return {"total_segments": 0}

        return {
            "total_segments": len(durations),
            "total_duration_sec": sum(durations),
            "avg_duration_sec": sum(durations) / len(durations),
            "min_duration_sec": min(durations),
            "max_duration_sec": max(durations),
            "avg_text_length": sum(text_lengths) / len(text_lengths) if text_lengths else 0,
            "duration_histogram": self._histogram(durations, bins=10),
        }

    def _histogram(self, values: list[float], bins: int = 10) -> list[dict]:
        if not values:
            return []
        mn, mx = min(values), max(values)
        if mn == mx:
            return [{"min": mn, "max": mx, "count": len(values)}]
        step = (mx - mn) / bins
        result = []
        for i in range(bins):
            lo = mn + i * step
            hi = mn + (i + 1) * step
            count = sum(1 for v in values if lo <= v < hi) if i < bins - 1 else sum(1 for v in values if lo <= v <= hi)
            result.append({"min": round(lo, 1), "max": round(hi, 1), "count": count})
        return result

    def _get_duration(self, path: Path) -> float:
        try:
            result = subprocess.run(
                ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
                 "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
                capture_output=True, text=True, timeout=5,
            )
            return float(result.stdout.strip())
        except Exception:
            return 0.0

    async def validate(self, dataset_id: str) -> list[dict]:
        """Валідація датасету — пошук проблем."""
        dataset = await self.get_by_id(dataset_id)
        if not dataset:
            return [{"level": "error", "message": "Датасет не знайдено"}]

        issues = []
        csv_path = settings.storage_path / dataset.csv_path
        audio_dir = settings.storage_path / dataset.audio_dir

        if not csv_path.exists():
            issues.append({"level": "error", "message": "metadata.csv не знайдено"})
            return issues

        lines = csv_path.read_text(encoding="utf-8").strip().split("\n")

        missing_audio = 0
        short_text = 0
        for line in lines:
            parts = line.split("|", 1)
            if len(parts) != 2:
                continue
            wav_name, text = parts
            if not (audio_dir / wav_name).exists():
                missing_audio += 1
            if len(text.strip()) < 3:
                short_text += 1

        if missing_audio:
            issues.append({"level": "error", "message": f"{missing_audio} аудіо файлів не знайдено"})
        if short_text:
            issues.append({"level": "warning", "message": f"{short_text} сегментів з коротким текстом (<3 символи)"})

        if dataset.total_duration < 60:
            issues.append({"level": "warning", "message": f"Датасет дуже короткий ({dataset.total_duration:.0f}с). Рекомендовано >30 хв"})
        elif dataset.total_duration < 1800:
            issues.append({"level": "info", "message": f"Датасет {dataset.total_duration/60:.0f} хв — підходить для fine-tuning"})

        if not issues:
            issues.append({"level": "success", "message": f"Датасет валідний: {len(lines)} сегментів, {dataset.total_duration/60:.1f} хв"})

        return issues
