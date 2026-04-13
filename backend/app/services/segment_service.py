from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.segment import Segment


class SegmentService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_batch(self, project_id: str, audio_file_id: str, segments: list[dict]) -> list[Segment]:
        """Створити сегменти з результатів транскрипції."""
        db_segments = []
        for seg_data in segments:
            segment = Segment(
                project_id=project_id,
                audio_file_id=audio_file_id,
                start_time=seg_data["start"],
                end_time=seg_data["end"],
                text=seg_data["text"],
            )
            self.db.add(segment)
            db_segments.append(segment)

        await self.db.commit()
        for seg in db_segments:
            await self.db.refresh(seg)
        return db_segments

    async def get_by_project(self, project_id: str) -> list[Segment]:
        result = await self.db.execute(
            select(Segment)
            .where(Segment.project_id == project_id)
            .order_by(Segment.start_time)
        )
        return list(result.scalars().all())

    async def get_by_audio_file(self, audio_file_id: str) -> list[Segment]:
        result = await self.db.execute(
            select(Segment)
            .where(Segment.audio_file_id == audio_file_id)
            .order_by(Segment.start_time)
        )
        return list(result.scalars().all())

    async def get_by_id(self, segment_id: str) -> Segment | None:
        result = await self.db.execute(
            select(Segment).where(Segment.id == segment_id)
        )
        return result.scalar_one_or_none()

    async def update(self, segment_id: str, text: str | None = None, included: bool | None = None) -> Segment | None:
        segment = await self.get_by_id(segment_id)
        if not segment:
            return None
        if text is not None:
            segment.text = text
            segment.text_edited = True
        if included is not None:
            segment.included = included
        await self.db.commit()
        await self.db.refresh(segment)
        return segment

    async def delete(self, segment_id: str) -> bool:
        segment = await self.get_by_id(segment_id)
        if not segment:
            return False
        await self.db.delete(segment)
        await self.db.commit()
        return True

    async def merge(self, segment_ids: list[str]) -> Segment | None:
        """Об'єднати кілька сегментів в один."""
        if len(segment_ids) < 2:
            return None

        segments = []
        for sid in segment_ids:
            seg = await self.get_by_id(sid)
            if seg:
                segments.append(seg)

        if len(segments) < 2:
            return None

        segments.sort(key=lambda s: s.start_time)

        # Create merged segment
        merged = Segment(
            project_id=segments[0].project_id,
            audio_file_id=segments[0].audio_file_id,
            start_time=segments[0].start_time,
            end_time=segments[-1].end_time,
            text=" ".join(s.text for s in segments),
            text_edited=True,
        )
        self.db.add(merged)

        # Delete originals
        for seg in segments:
            await self.db.delete(seg)

        await self.db.commit()
        await self.db.refresh(merged)
        return merged

    async def split(self, segment_id: str, split_time: float) -> tuple[Segment, Segment] | None:
        """Розділити сегмент на два в заданій точці часу."""
        segment = await self.get_by_id(segment_id)
        if not segment:
            return None
        if split_time <= segment.start_time or split_time >= segment.end_time:
            return None

        # Create two new segments
        seg1 = Segment(
            project_id=segment.project_id,
            audio_file_id=segment.audio_file_id,
            start_time=segment.start_time,
            end_time=split_time,
            text=segment.text,
            text_edited=True,
        )
        seg2 = Segment(
            project_id=segment.project_id,
            audio_file_id=segment.audio_file_id,
            start_time=split_time,
            end_time=segment.end_time,
            text="",
            text_edited=True,
        )
        self.db.add(seg1)
        self.db.add(seg2)
        await self.db.delete(segment)
        await self.db.commit()
        await self.db.refresh(seg1)
        await self.db.refresh(seg2)
        return seg1, seg2

    async def delete_by_project(self, project_id: str) -> int:
        """Видалити всі сегменти проєкту."""
        segments = await self.get_by_project(project_id)
        count = len(segments)
        for seg in segments:
            await self.db.delete(seg)
        await self.db.commit()
        return count
