FROM nvidia/cuda:12.1.1-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PATH="/root/.deno/bin:/root/.local/bin:${PATH}" \
    XDG_CURRENT_DESKTOP=GNOME \
    DESKTOP_SESSION=gnome

RUN apt-get update && apt-get install -y --no-install-recommends \
    software-properties-common && \
    add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3.11-venv python3.11-dev \
    espeak-ng libespeak-ng-dev \
    ffmpeg \
    build-essential cmake ninja-build \
    git curl \
    && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 && \
    curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11

RUN curl -fsSL https://deno.land/install.sh | sh

WORKDIR /app

RUN pip install --no-cache-dir \
    torch --index-url https://download.pytorch.org/whl/cu121

RUN pip install --no-cache-dir \
    faster-whisper \
    fastapi "uvicorn[standard]" \
    "sqlalchemy[asyncio]" aiosqlite alembic \
    pydantic pydantic-settings \
    "celery[redis]" redis \
    yt-dlp pydub \
    python-multipart httpx \
    secretstorage pycryptodome

COPY . .

RUN mkdir -p storage/projects storage/pretrained

CMD ["celery", "-A", "app.tasks", "worker", "-Q", "gpu", "--concurrency=1", "-n", "gpu@%h", "--loglevel=info"]
