import asyncio
import io
import zipfile

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.synthesis import (
    ExportedModelResponse,
    ExportRequest,
    SynthesizeRequest,
)
from app.services.export_service import ExportService
from app.services.synthesis_service import SynthesisService

router = APIRouter()


@router.post("/export", response_model=ExportedModelResponse)
async def export_model(
    data: ExportRequest,
    db: AsyncSession = Depends(get_db),
):
    """Експортувати checkpoint в ONNX формат."""
    service = ExportService(db)
    try:
        model = await service.export_onnx(
            project_id=data.project_id,
            checkpoint_path=data.checkpoint_path,
        )
        # Update project status
        from app.services.project_service import ProjectService
        await ProjectService(db).update_status(data.project_id, "exported")
        return model
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}", response_model=list[ExportedModelResponse])
async def list_models(project_id: str, db: AsyncSession = Depends(get_db)):
    """Список експортованих моделей проєкту."""
    service = ExportService(db)
    return await service.get_by_project(project_id)


@router.get("/download-zip/{model_id}")
async def download_zip(model_id: str, db: AsyncSession = Depends(get_db)):
    """Скачати модель як ZIP архів (ONNX + config JSON)."""
    export_service = ExportService(db)
    model = await export_service.get_by_id(model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Модель не знайдено")

    onnx_path = settings.storage_path / model.onnx_path
    config_path = settings.storage_path / model.config_path

    if not onnx_path.exists():
        raise HTTPException(status_code=404, detail="ONNX файл не знайдено")

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(onnx_path, onnx_path.name)
        if config_path.exists():
            zf.write(config_path, config_path.name)

    buf.seek(0)
    zip_name = onnx_path.stem + ".zip"
    return Response(
        content=buf.getvalue(),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )


@router.post("/synthesize")
async def synthesize(
    data: SynthesizeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Синтезувати мовлення з ONNX моделі."""
    # Get model
    export_service = ExportService(db)
    model = await export_service.get_by_id(data.model_id)
    if not model:
        raise HTTPException(status_code=404, detail="Модель не знайдено")

    try:
        synth = SynthesisService()
        wav_bytes = await asyncio.to_thread(
            synth.synthesize,
            model.onnx_path,
            model.config_path,
            data.text,
            speaker_id=data.speaker_id,
            length_scale=data.length_scale,
            noise_scale=data.noise_scale,
            noise_w=data.noise_w,
        )
        return Response(content=wav_bytes, media_type="audio/wav")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Помилка синтезу: {str(e)}")
