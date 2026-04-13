import asyncio

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.youtube import (
    AudioFileResponse,
    YoutubeDownloadRequest,
    YoutubeInfoResponse,
)
from app.services.audio_file_service import AudioFileService
from app.services.youtube_service import YoutubeService

router = APIRouter()


@router.post("/info", response_model=YoutubeInfoResponse)
async def get_video_info(url: str):
    """Отримати інформацію про YouTube відео."""
    try:
        service = YoutubeService()
        info = await asyncio.to_thread(service.get_video_info, url)
        return info
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Не вдалося отримати інформацію: {str(e)}")


@router.post("/download", response_model=AudioFileResponse)
async def download_youtube(
    data: YoutubeDownloadRequest,
    db: AsyncSession = Depends(get_db),
):
    """Завантажити аудіо з YouTube."""
    try:
        import os
        # Ensure GNOME env for Chrome keyring access in worker thread
        os.environ.setdefault("XDG_CURRENT_DESKTOP", "GNOME")
        os.environ.setdefault("DESKTOP_SESSION", "gnome")

        yt_service = YoutubeService()

        # Download audio
        result = await asyncio.to_thread(
            yt_service.download_audio,
            data.url,
            data.project_id,
            data.audio_format,
        )

        # Save to database
        af_service = AudioFileService(db)
        audio_file = await af_service.create(
            project_id=data.project_id,
            filename=result["filename"],
            file_path=result["file_path"],
            source_url=result["source_url"],
            duration_sec=result["duration_sec"],
            file_size_bytes=result["file_size_bytes"],
        )

        return audio_file

    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Помилка завантаження: {str(e)}",
        )


@router.post("/upload", response_model=AudioFileResponse)
async def upload_audio(
    project_id: str = Form(...),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """Завантажити аудіо файл напряму."""
    allowed_extensions = {".wav", ".mp3", ".flac", ".ogg", ".m4a"}
    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in allowed_extensions:
        raise HTTPException(
            status_code=400,
            detail=f"Непідтримуваний формат. Дозволено: {', '.join(allowed_extensions)}",
        )

    content = await file.read()
    if len(content) > 500 * 1024 * 1024:  # 500MB limit
        raise HTTPException(status_code=400, detail="Файл занадто великий (макс. 500MB)")

    service = AudioFileService(db)
    audio_file = await service.save_uploaded_file(
        project_id=project_id,
        filename=file.filename,
        content=content,
    )
    return audio_file


@router.get("/files/{project_id}", response_model=list[AudioFileResponse])
async def list_audio_files(project_id: str, db: AsyncSession = Depends(get_db)):
    """Список аудіо файлів проєкту."""
    service = AudioFileService(db)
    return await service.get_by_project(project_id)


@router.delete("/files/{audio_file_id}")
async def delete_audio_file(audio_file_id: str, db: AsyncSession = Depends(get_db)):
    """Видалити аудіо файл."""
    service = AudioFileService(db)
    deleted = await service.delete(audio_file_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    return {"success": True, "message": "Файл видалено"}


@router.post("/cookies")
async def upload_cookies(file: UploadFile = File(...)):
    """Завантажити cookies.txt для доступу до захищених відео YouTube."""
    if not file.filename.endswith(".txt"):
        raise HTTPException(status_code=400, detail="Потрібен файл cookies.txt")
    content = await file.read()
    cookies_path = settings.storage_path / "cookies.txt"
    cookies_path.write_bytes(content)
    return {"success": True, "message": "Cookies збережено"}


@router.post("/cookies/refresh")
async def refresh_cookies():
    """Оновити cookies з Chrome браузера."""
    service = YoutubeService()
    success = await asyncio.to_thread(service.ensure_cookies)
    if success:
        return {"success": True, "message": "Cookies оновлено з Chrome"}
    raise HTTPException(status_code=500, detail="Не вдалося оновити cookies. Переконайтесь що Chrome авторизований у YouTube.")


@router.get("/cookies/status")
async def cookies_status():
    """Перевірити наявність cookies."""
    cookies_path = settings.storage_path / "cookies.txt"
    return {"has_cookies": cookies_path.exists()}
