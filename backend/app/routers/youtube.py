import asyncio

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
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


@router.get("/progress/{task_id}")
async def download_progress(task_id: str):
    """Прогрес завантаження."""
    from app.utils.progress import get_progress
    p = get_progress(task_id)
    return p or {"progress": 0, "message": "Очікування..."}


@router.post("/download", response_model=AudioFileResponse)
async def download_youtube(
    data: YoutubeDownloadRequest,
    db: AsyncSession = Depends(get_db),
):
    """Завантажити аудіо з YouTube."""
    try:
        import os, uuid
        os.environ.setdefault("XDG_CURRENT_DESKTOP", "GNOME")
        os.environ.setdefault("DESKTOP_SESSION", "gnome")

        task_id = str(uuid.uuid4())
        from app.utils.progress import set_progress, clear_progress
        set_progress(task_id, 0, "Підключення до YouTube...")

        yt_service = YoutubeService()

        def progress_hook(d):
            if d.get("status") == "downloading":
                pct = d.get("_percent_str", "0%").strip().replace("%", "")
                try:
                    set_progress(task_id, int(float(pct)), f"Завантаження: {pct}%")
                except ValueError:
                    pass
            elif d.get("status") == "finished":
                set_progress(task_id, 90, "Конвертація в WAV...")

        result = await asyncio.to_thread(
            yt_service.download_audio,
            data.url,
            data.project_id,
            data.audio_format,
            progress_hook,
        )
        set_progress(task_id, 100, "Завершено")
        clear_progress(task_id)

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
    content = await file.read()
    # Netscape format starts with "# Netscape HTTP Cookie File" або "# HTTP Cookie File"
    head = content[:200].decode("utf-8", errors="ignore").lstrip()
    if not (file.filename.endswith(".txt") or head.startswith("#") and "Cookie" in head):
        raise HTTPException(status_code=400, detail="Очікується cookies.txt у Netscape форматі")
    cookies_path = settings.storage_path / "cookies.txt"
    cookies_path.write_bytes(content)
    return {"success": True, "message": "Cookies збережено", "size_bytes": len(content)}


@router.delete("/cookies")
async def delete_cookies():
    """Видалити збережені cookies."""
    cookies_path = settings.storage_path / "cookies.txt"
    if cookies_path.exists():
        cookies_path.unlink()
        return {"success": True, "message": "Cookies видалено"}
    return {"success": False, "message": "Cookies не знайдено"}


@router.post("/cookies/extract")
async def extract_cookies(browser: str = "firefox"):
    """Автоматично витягти cookies з браузера (Firefox працює без D-Bus)."""
    service = YoutubeService()
    success, message = await asyncio.to_thread(service.extract_cookies_from_browser, browser)
    if success:
        return {"success": True, "message": message}
    raise HTTPException(status_code=400, detail=message)


@router.get("/cookies/status")
async def cookies_status():
    """Перевірити наявність cookies."""
    cookies_path = settings.storage_path / "cookies.txt"
    return {"has_cookies": cookies_path.exists()}
