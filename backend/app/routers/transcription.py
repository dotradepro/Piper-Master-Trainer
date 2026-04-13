import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.transcription import (
    MergeRequest,
    SegmentResponse,
    SegmentUpdate,
    SplitRequest,
    TranscriptionRequest,
)
from app.services.segment_service import SegmentService
from app.services.transcription_service import TranscriptionService

router = APIRouter()


@router.post("/start", response_model=list[SegmentResponse])
async def start_transcription(
    data: TranscriptionRequest,
    db: AsyncSession = Depends(get_db),
):
    """Запустити транскрипцію аудіо файлу."""
    from app.services.audio_file_service import AudioFileService

    # Verify audio file exists
    af_service = AudioFileService(db)
    audio_file = await af_service.get_by_id(data.audio_file_id)
    if not audio_file:
        raise HTTPException(status_code=404, detail="Аудіо файл не знайдено")

    # Clear existing segments for this audio file
    seg_service = SegmentService(db)
    existing = await seg_service.get_by_audio_file(data.audio_file_id)
    for seg in existing:
        await seg_service.delete(seg.id)

    # Transcribe
    try:
        ts = TranscriptionService()
        raw_segments = await asyncio.to_thread(
            ts.transcribe,
            audio_file.file_path,
            language=data.language,
            model_size=data.model_size,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка транскрипції: {str(e)}")

    if not raw_segments:
        raise HTTPException(status_code=400, detail="Транскрипція не виявила мовлення")

    # Save segments to database
    segments = await seg_service.create_batch(
        project_id=data.project_id,
        audio_file_id=data.audio_file_id,
        segments=raw_segments,
    )

    # Update project status
    from app.services.project_service import ProjectService
    await ProjectService(db).update_status(data.project_id, "transcribing")

    return segments


@router.get("/segments/{project_id}", response_model=list[SegmentResponse])
async def list_segments(project_id: str, db: AsyncSession = Depends(get_db)):
    """Отримати всі сегменти проєкту."""
    service = SegmentService(db)
    return await service.get_by_project(project_id)


@router.put("/segments/{segment_id}", response_model=SegmentResponse)
async def update_segment(
    segment_id: str,
    data: SegmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Оновити текст або включення сегменту."""
    service = SegmentService(db)
    segment = await service.update(segment_id, text=data.text, included=data.included)
    if not segment:
        raise HTTPException(status_code=404, detail="Сегмент не знайдено")
    return segment


@router.delete("/segments/{segment_id}")
async def delete_segment(segment_id: str, db: AsyncSession = Depends(get_db)):
    """Видалити сегмент."""
    service = SegmentService(db)
    deleted = await service.delete(segment_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Сегмент не знайдено")
    return {"success": True}


@router.post("/segments/merge", response_model=SegmentResponse)
async def merge_segments(data: MergeRequest, db: AsyncSession = Depends(get_db)):
    """Об'єднати кілька сегментів."""
    service = SegmentService(db)
    merged = await service.merge(data.segment_ids)
    if not merged:
        raise HTTPException(status_code=400, detail="Не вдалося об'єднати сегменти")
    return merged


@router.post("/segments/{segment_id}/split", response_model=list[SegmentResponse])
async def split_segment(
    segment_id: str,
    data: SplitRequest,
    db: AsyncSession = Depends(get_db),
):
    """Розділити сегмент на два."""
    service = SegmentService(db)
    result = await service.split(segment_id, data.split_time)
    if not result:
        raise HTTPException(status_code=400, detail="Не вдалося розділити сегмент")
    return list(result)


@router.get("/models")
async def available_models():
    """Доступні моделі Whisper та рекомендації для GPU."""
    return {
        "models": [
            {"id": "tiny", "size_mb": 75, "vram_mb": 400, "speed": "fastest", "quality": "low"},
            {"id": "base", "size_mb": 145, "vram_mb": 500, "speed": "fast", "quality": "medium"},
            {"id": "small", "size_mb": 488, "vram_mb": 1000, "speed": "medium", "quality": "good"},
            {"id": "medium", "size_mb": 1500, "vram_mb": 2500, "speed": "slow", "quality": "high"},
            {"id": "large-v3", "size_mb": 3000, "vram_mb": 4500, "speed": "slowest", "quality": "best"},
        ],
        "recommended": "small",
        "note": "RTX 3050 (4GB): small рекомендовано, medium можливо",
    }
