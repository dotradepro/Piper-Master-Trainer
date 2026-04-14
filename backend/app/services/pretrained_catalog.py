"""Каталог публічних Piper voice checkpoints з Hugging Face + фонове завантаження."""

import asyncio
import logging
from pathlib import Path
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

HF_DATASET = "rhasspy/piper-checkpoints"
HF_API_TREE = f"https://huggingface.co/api/datasets/{HF_DATASET}/tree/main"
HF_RESOLVE = f"https://huggingface.co/datasets/{HF_DATASET}/resolve/main"

# Curated catalog. id => (language, locale, voice, quality, gender, label, espeak_voice)
CATALOG: list[dict] = [
    # Ukrainian
    {"id": "uk_UA-lada-x_low", "language": "uk", "locale": "uk_UA", "voice": "lada", "quality": "x_low", "gender": "female", "espeak_voice": "uk", "label": "Lada (жіночий, low)"},
    {"id": "uk_UA-ukrainian_tts-medium", "language": "uk", "locale": "uk_UA", "voice": "ukrainian_tts", "quality": "medium", "gender": "male", "espeak_voice": "uk", "label": "Ukrainian TTS (чоловічий, medium)"},
    # English (US)
    {"id": "en_US-lessac-medium", "language": "en", "locale": "en_US", "voice": "lessac", "quality": "medium", "gender": "male", "espeak_voice": "en-us", "label": "Lessac (male, medium)"},
    {"id": "en_US-amy-medium", "language": "en", "locale": "en_US", "voice": "amy", "quality": "medium", "gender": "female", "espeak_voice": "en-us", "label": "Amy (female, medium)"},
    {"id": "en_US-ryan-medium", "language": "en", "locale": "en_US", "voice": "ryan", "quality": "medium", "gender": "male", "espeak_voice": "en-us", "label": "Ryan (male, medium)"},
    # Russian
    {"id": "ru_RU-irina-medium", "language": "ru", "locale": "ru_RU", "voice": "irina", "quality": "medium", "gender": "female", "espeak_voice": "ru", "label": "Irina (жен., medium)"},
    {"id": "ru_RU-dmitri-medium", "language": "ru", "locale": "ru_RU", "voice": "dmitri", "quality": "medium", "gender": "male", "espeak_voice": "ru", "label": "Dmitri (муж., medium)"},
    # Polish
    {"id": "pl_PL-gosia-medium", "language": "pl", "locale": "pl_PL", "voice": "gosia", "quality": "medium", "gender": "female", "espeak_voice": "pl", "label": "Gosia (female, medium)"},
    # German
    {"id": "de_DE-thorsten-medium", "language": "de", "locale": "de_DE", "voice": "thorsten", "quality": "medium", "gender": "male", "espeak_voice": "de", "label": "Thorsten (male, medium)"},
]


# In-memory tracker of active downloads: voice_id -> {status, progress, total, error, filename}
_downloads: dict[str, dict] = {}
_downloads_lock = asyncio.Lock()


def get_catalog() -> list[dict]:
    """Повернути каталог з прапорцем чи модель вже локально."""
    local = {p.name for p in settings.pretrained_path.glob("*.ckpt")} if settings.pretrained_path.exists() else set()
    result = []
    for entry in CATALOG:
        result.append({
            **entry,
            "local_filename": f"{entry['id']}.ckpt",
            "installed": f"{entry['id']}.ckpt" in local,
        })
    return result


def get_download_status(voice_id: str) -> Optional[dict]:
    return _downloads.get(voice_id)


def list_active_downloads() -> dict[str, dict]:
    return dict(_downloads)


async def _find_ckpt_url(entry: dict) -> str:
    """Знайти .ckpt файл у папці голосу через HF tree API."""
    folder = f"{entry['language']}/{entry['locale']}/{entry['voice']}/{entry['quality']}"
    tree_url = f"{HF_API_TREE}/{folder}"
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        resp = await client.get(tree_url)
        resp.raise_for_status()
        items = resp.json()

    ckpts = [it for it in items if it.get("type") == "file" and it.get("path", "").endswith(".ckpt")]
    if not ckpts:
        raise RuntimeError(f"У папці {folder} не знайдено .ckpt файлів")

    # Prefer highest step number
    def step_of(p: str) -> int:
        import re
        m = re.search(r"step=(\d+)", p)
        return int(m.group(1)) if m else 0

    ckpts.sort(key=lambda it: step_of(it["path"]), reverse=True)
    return f"{HF_RESOLVE}/{ckpts[0]['path']}"


async def download_voice(voice_id: str) -> dict:
    """Запустити фонове завантаження голосу. Повертає initial status."""
    entry = next((e for e in CATALOG if e["id"] == voice_id), None)
    if not entry:
        raise ValueError(f"Невідомий voice_id: {voice_id}")

    async with _downloads_lock:
        existing = _downloads.get(voice_id)
        if existing and existing["status"] == "downloading":
            return existing
        _downloads[voice_id] = {
            "voice_id": voice_id,
            "status": "starting",
            "progress": 0,
            "total": 0,
            "downloaded": 0,
            "error": None,
            "filename": f"{voice_id}.ckpt",
        }

    asyncio.create_task(_download_task(voice_id, entry))
    return _downloads[voice_id]


async def _download_task(voice_id: str, entry: dict):
    state = _downloads[voice_id]
    dest = settings.pretrained_path / f"{voice_id}.ckpt"
    tmp = dest.with_suffix(".ckpt.part")
    settings.pretrained_path.mkdir(parents=True, exist_ok=True)

    try:
        state["status"] = "resolving"
        url = await _find_ckpt_url(entry)
        logger.info(f"Downloading {voice_id} from {url}")

        state["status"] = "downloading"
        async with httpx.AsyncClient(timeout=None, follow_redirects=True) as client:
            async with client.stream("GET", url) as resp:
                resp.raise_for_status()
                total = int(resp.headers.get("content-length", 0))
                state["total"] = total
                downloaded = 0
                with tmp.open("wb") as f:
                    async for chunk in resp.aiter_bytes(1024 * 1024):
                        f.write(chunk)
                        downloaded += len(chunk)
                        state["downloaded"] = downloaded
                        if total:
                            state["progress"] = round(downloaded / total * 100, 1)

        tmp.rename(dest)
        state["status"] = "done"
        state["progress"] = 100.0
        logger.info(f"Downloaded {voice_id} -> {dest}")
    except Exception as e:
        logger.exception(f"Download failed for {voice_id}")
        state["status"] = "error"
        state["error"] = str(e)
        if tmp.exists():
            try:
                tmp.unlink()
            except Exception:
                pass
