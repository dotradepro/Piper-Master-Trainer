import os
import re
import subprocess
from pathlib import Path

from app.config import settings

# Ensure deno is in PATH for yt-dlp JS runtime
_deno_path = Path.home() / ".deno" / "bin"
if _deno_path.exists() and str(_deno_path) not in os.environ.get("PATH", ""):
    os.environ["PATH"] = f"{_deno_path}:{os.environ.get('PATH', '')}"

# Set GNOME desktop environment for proper keyring access (Chrome cookie decryption)
if not os.environ.get("XDG_CURRENT_DESKTOP"):
    os.environ["XDG_CURRENT_DESKTOP"] = "GNOME"
if not os.environ.get("DESKTOP_SESSION"):
    os.environ["DESKTOP_SESSION"] = "gnome"


class YoutubeService:
    def _get_common_opts(self) -> dict:
        """Загальні опції для yt-dlp."""
        opts: dict = {
            "quiet": True,
            "no_warnings": True,
            "remote_components": {"ejs:github"},
        }
        # Use cookies.txt if available
        cookies_file = settings.storage_path / "cookies.txt"
        if cookies_file.exists():
            opts["cookiefile"] = str(cookies_file)
        else:
            # Try browser cookies
            opts["cookiesfrombrowser"] = ("chrome",)
        return opts

    def ensure_cookies(self) -> bool:
        """Експортувати Chrome cookies, якщо cookies.txt ще не існує.
        Використовує yt-dlp напряму для коректного дешифрування."""
        cookies_file = settings.storage_path / "cookies.txt"
        if cookies_file.exists():
            return True

        import yt_dlp
        # Use yt-dlp's own cookie extraction to create cookies.txt
        ydl_opts = {
            "quiet": True,
            "cookiesfrombrowser": ("chrome",),
            "remote_components": {"ejs:github"},
            "cookiefile": str(cookies_file),  # yt-dlp will save cookies here
            "simulate": True,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # Just extract info from any video to trigger cookie export
                ydl.extract_info("https://www.youtube.com/watch?v=dQw4w9WgXcQ", download=False)
            return cookies_file.exists()
        except Exception:
            return cookies_file.exists()

    def get_video_info(self, url: str) -> dict:
        """Отримати інформацію про відео без завантаження."""
        import yt_dlp

        ydl_opts = {
            **self._get_common_opts(),
            "extract_flat": False,
        }
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            return {
                "title": info.get("title", "Unknown"),
                "duration": info.get("duration", 0),
                "uploader": info.get("uploader", "Unknown"),
                "thumbnail": info.get("thumbnail", ""),
                "description": info.get("description", "")[:500],
            }

    def download_audio(
        self,
        url: str,
        project_id: str,
        audio_format: str = "wav",
        progress_callback=None,
    ) -> dict:
        """Завантажити аудіо з YouTube та конвертувати в WAV."""
        import yt_dlp

        output_dir = settings.projects_path / project_id / "raw_audio"
        output_dir.mkdir(parents=True, exist_ok=True)

        output_template = str(output_dir / "%(title)s.%(ext)s")

        ydl_opts = {
            **self._get_common_opts(),
            "format": "bestaudio/best",
            "outtmpl": output_template,
            "postprocessors": [
                {
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": audio_format,
                    "preferredquality": "0",
                }
            ],
        }

        if progress_callback:
            ydl_opts["progress_hooks"] = [progress_callback]

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=True)

            title = info.get("title", "audio")
            safe_title = re.sub(r'[<>:"/\\|?*]', '_', title)

            # Find the output file - try exact match first
            output_file = None
            for f in output_dir.iterdir():
                if f.suffix == f".{audio_format}" and f.stem.startswith(safe_title[:20]):
                    output_file = f
                    break

            # Fallback: most recently created audio file
            if not output_file:
                audio_files = sorted(
                    output_dir.glob(f"*.{audio_format}"),
                    key=lambda p: p.stat().st_mtime,
                    reverse=True,
                )
                if audio_files:
                    output_file = audio_files[0]

            if not output_file or not output_file.exists():
                raise FileNotFoundError(
                    f"Завантажений файл не знайдено в {output_dir}"
                )

            file_size = output_file.stat().st_size
            duration = info.get("duration", 0)

            if not duration:
                duration = self._get_audio_duration(output_file)

            return {
                "title": title,
                "filename": output_file.name,
                "file_path": str(output_file.relative_to(settings.storage_path)),
                "absolute_path": str(output_file),
                "duration_sec": duration,
                "file_size_bytes": file_size,
                "source_url": url,
            }

    def _get_audio_duration(self, file_path: Path) -> float:
        """Отримати тривалість аудіо через ffprobe."""
        try:
            result = subprocess.run(
                [
                    "ffprobe",
                    "-v", "quiet",
                    "-show_entries", "format=duration",
                    "-of", "default=noprint_wrappers=1:nokey=1",
                    str(file_path),
                ],
                capture_output=True,
                text=True,
                timeout=10,
            )
            return float(result.stdout.strip())
        except Exception:
            return 0.0
