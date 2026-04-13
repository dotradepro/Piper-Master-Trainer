import asyncio
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.training import (
    CheckpointInfo,
    TrainingStartRequest,
    TrainingStatusResponse,
)
from app.services.training_service import TrainingService

router = APIRouter()
_training_service = TrainingService()


@router.post("/start")
async def start_training(
    data: TrainingStartRequest,
    db: AsyncSession = Depends(get_db),
):
    """Запустити тренування VITS моделі."""
    from app.services.dataset_service import DatasetService

    # Get dataset
    ds_service = DatasetService(db)
    dataset = await ds_service.get_by_id(data.dataset_id)
    if not dataset:
        raise HTTPException(status_code=404, detail="Датасет не знайдено")

    run_id = str(uuid.uuid4())

    try:
        await asyncio.to_thread(
            _training_service.start_training,
            run_id=run_id,
            project_id=data.project_id,
            dataset_id=data.dataset_id,
            csv_path=dataset.csv_path,
            audio_dir=dataset.audio_dir,
            mode=data.mode,
            base_checkpoint=data.base_checkpoint,
            batch_size=data.batch_size,
            max_epochs=data.max_epochs,
            precision=data.precision,
            accumulate_grad_batches=data.accumulate_grad_batches,
            sample_rate=data.sample_rate,
            espeak_voice=data.espeak_voice,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка запуску тренування: {str(e)}")

    # Update project status
    from app.services.project_service import ProjectService
    await ProjectService(db).update_status(data.project_id, "training")

    return {"run_id": run_id, "status": "started"}


@router.post("/stop")
async def stop_training(run_id: str | None = None):
    """Зупинити тренування."""
    status = _training_service.get_status()
    if not status["active"]:
        raise HTTPException(status_code=404, detail="Немає активного тренування")

    rid = run_id or status.get("run_id")
    success = await asyncio.to_thread(_training_service.stop_training, rid)
    if not success:
        raise HTTPException(status_code=404, detail="Тренування не знайдено")
    return {"status": "stopped"}


@router.get("/status", response_model=TrainingStatusResponse)
async def training_status():
    """Стан тренування."""
    return _training_service.get_status()


@router.get("/logs")
async def training_logs(last_n: int = 100):
    """Останні N рядків логу тренування."""
    return {"lines": _training_service.get_logs(last_n)}


@router.get("/checkpoints/{project_id}", response_model=list[CheckpointInfo])
async def list_checkpoints(project_id: str):
    """Список чекпоінтів проєкту."""
    return _training_service.list_checkpoints(project_id)


@router.get("/pretrained", response_model=list[CheckpointInfo])
async def list_pretrained():
    """Список претренованих моделей."""
    return _training_service.list_pretrained()
