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
        # Priority: (1) cookies.txt (2) Firefox (unencrypted, works in Docker)
        # Chrome cookies skipped — require D-Bus/keyring for decryption, not available in container.
        cookies_file = settings.storage_path / "cookies.txt"
        if cookies_file.exists():
            opts["cookiefile"] = str(cookies_file)
        elif Path("/root/.mozilla/firefox").exists():
            opts["cookiesfrombrowser"] = ("firefox",)
        return opts

    def extract_cookies_from_browser(self, browser: str = "firefox") -> tuple[bool, str]:
        """Витягти cookies з браузера, що встановлено в контейнері/замонтовано.
        Firefox працює без D-Bus/keyring. Chrome у Docker не підтримується
        (cookies зашифровані libsecret/gnome-keyring). Повертає (success, message)."""
        if browser not in ("firefox", "chrome"):
            return False, f"Непідтримуваний браузер: {browser}"

        # Перевірка наявності профілю
        if browser == "firefox" and not Path("/root/.mozilla/firefox").exists():
            return False, "Firefox профіль не знайдено. Змонтуй ~/.mozilla/firefox у docker-compose.yml"
        if browser == "chrome" and not Path("/root/.config/google-chrome").exists():
            return False, "Chrome профіль не знайдено"

        cookies_file = settings.storage_path / "cookies.txt"
        cookies_file.parent.mkdir(parents=True, exist_ok=True)

        import yt_dlp
        ydl_opts = {
            "quiet": True,
            "no_warnings": True,
            "cookiesfrombrowser": (browser,),
            "cookiefile": str(cookies_file),
            "simulate": True,
            "skip_download": True,
            "extract_flat": True,
        }
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                # Легкий запит до youtube.com щоб ініціалізувати cookie jar
                ydl.extract_info("https://www.youtube.com/", download=False, process=False)
        except Exception as e:
            # extract_info може впасти через age-gate чи мережу — cookies все одно
            # могли бути витягнуті під час ініціалізації YoutubeDL.
            if not cookies_file.exists():
                return False, f"Не вдалося витягти cookies з {browser}: {e}"

        if not cookies_file.exists() or cookies_file.stat().st_size < 100:
            return False, (
                f"Cookies порожні. Переконайся що {browser} залогінений у youtube.com "
                f"(відкрий браузер на хості, зайди на youtube.com, залогінься)."
            )

        # Перевірка чи є youtube auth cookies
        content = cookies_file.read_text(errors="ignore")
        auth_markers = ("__Secure-1PSID", "__Secure-3PSID", "LOGIN_INFO")
        has_youtube_line = ".youtube.com" in content or "youtube.com" in content
        if not has_youtube_line or not any(m in content for m in auth_markers):
            # Видаляємо, щоб статус не казав "cookies активні" коли вони марні
            try:
                cookies_file.unlink()
            except Exception:
                pass
            return False, (
                f"У cookies немає YouTube auth. Відкрий Firefox на хості, "
                f"зайди на youtube.com, залогінься, і натисни 'Авто з Firefox' знову."
            )

        size_kb = cookies_file.stat().st_size / 1024
        return True, f"Cookies витягнуто з {browser} ({size_kb:.1f} KB)"

    def ensure_cookies(self) -> bool:
        """Legacy: підтримка старого API. Пробує Firefox."""
        cookies_file = settings.storage_path / "cookies.txt"
        if cookies_file.exists():
            return True
        success, _ = self.extract_cookies_from_browser("firefox")
        return success

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
