from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.config import settings
from app.database import init_db
from app.routers import datasets, models, projects, training, transcription, ws, youtube


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    settings.storage_path.mkdir(parents=True, exist_ok=True)
    settings.projects_path.mkdir(parents=True, exist_ok=True)
    settings.pretrained_path.mkdir(parents=True, exist_ok=True)
    await init_db()

    # Auto-export Chrome cookies for YouTube age-restricted videos
    cookies_file = settings.storage_path / "cookies.txt"
    if not cookies_file.exists():
        try:
            from app.services.youtube_service import YoutubeService
            YoutubeService().ensure_cookies()
        except Exception:
            pass  # Cookies are optional

    yield
    # Shutdown


app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Веб-додаток для тренування голосових моделей Piper TTS",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(youtube.router, prefix="/api/youtube", tags=["youtube"])
app.include_router(transcription.router, prefix="/api/transcription", tags=["transcription"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["datasets"])
app.include_router(training.router, prefix="/api/training", tags=["training"])
app.include_router(models.router, prefix="/api/models", tags=["models"])
app.include_router(ws.router, prefix="/ws", tags=["websocket"])


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.app_name}


@app.get("/api/system/gpu")
async def gpu_status():
    from app.services.gpu_manager import GpuManager

    gpu = GpuManager()
    return gpu.get_status()


@app.get("/api/audio/{file_path:path}")
async def serve_audio(file_path: str):
    """Стрімінг аудіо файлів для плеєра."""
    abs_path = settings.storage_path / file_path
    if not abs_path.exists() or not abs_path.is_file():
        raise HTTPException(status_code=404, detail="Файл не знайдено")
    # Security: ensure path is within storage
    try:
        abs_path.resolve().relative_to(settings.storage_path.resolve())
    except ValueError:
        raise HTTPException(status_code=403, detail="Доступ заборонено")
    if abs_path.suffix == ".onnx":
        return FileResponse(abs_path, media_type="application/octet-stream", filename=abs_path.name)
    if abs_path.suffix == ".json":
        return FileResponse(abs_path, media_type="application/json", filename=abs_path.name)
    media_type = "audio/wav" if abs_path.suffix == ".wav" else f"audio/{abs_path.suffix[1:]}"
    return FileResponse(abs_path, media_type=media_type)
