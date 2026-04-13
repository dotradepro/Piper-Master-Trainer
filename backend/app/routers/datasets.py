import asyncio

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.dataset import (
    DatasetPrepareRequest,
    DatasetResponse,
    DatasetStatsResponse,
    ValidationIssue,
)
from app.services.dataset_service import DatasetService

router = APIRouter()


@router.post("/prepare", response_model=DatasetResponse)
async def prepare_dataset(
    data: DatasetPrepareRequest,
    db: AsyncSession = Depends(get_db),
):
    """Підготувати датасет з транскрибованих сегментів."""
    service = DatasetService(db)
    try:
        dataset = await service.prepare(
            project_id=data.project_id,
            min_duration=data.min_duration,
            max_duration=data.max_duration,
            sample_rate=data.sample_rate,
        )
        # Update project status
        from app.services.project_service import ProjectService
        await ProjectService(db).update_status(data.project_id, "dataset_ready")
        return dataset
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка підготовки датасету: {str(e)}")


@router.get("/{project_id}", response_model=list[DatasetResponse])
async def list_datasets(project_id: str, db: AsyncSession = Depends(get_db)):
    """Список датасетів проєкту."""
    service = DatasetService(db)
    return await service.get_by_project(project_id)


@router.get("/{dataset_id}/stats", response_model=DatasetStatsResponse)
async def dataset_stats(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Статистика датасету."""
    service = DatasetService(db)
    stats = await service.get_stats(dataset_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Датасет не знайдено")
    return stats


@router.get("/{dataset_id}/validate", response_model=list[ValidationIssue])
async def validate_dataset(dataset_id: str, db: AsyncSession = Depends(get_db)):
    """Валідація якості датасету."""
    service = DatasetService(db)
    return await service.validate(dataset_id)


@router.get("/{dataset_id}/preview")
async def preview_csv(dataset_id: str, limit: int = 20, db: AsyncSession = Depends(get_db)):
    """Перегляд перших N рядків metadata.csv."""
    from app.config import settings

    service = DatasetService(db)
    dataset = await service.get_by_id(dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Датасет не знайдено")

    csv_path = settings.storage_path / dataset.csv_path
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="CSV не знайдено")

    lines = csv_path.read_text(encoding="utf-8").strip().split("\n")[:limit]
    rows = []
    for line in lines:
        parts = line.split("|", 1)
        if len(parts) == 2:
            rows.append({"filename": parts[0], "text": parts[1]})
    return {"total": dataset.total_segments, "rows": rows}
