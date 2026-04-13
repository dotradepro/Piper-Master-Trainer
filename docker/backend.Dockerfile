FROM pytorch/pytorch:2.5.1-cuda12.1-cudnn9-runtime

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PATH="/root/.deno/bin:/opt/piper1-gpl:${PATH}" \
    XDG_CURRENT_DESKTOP=GNOME \
    DESKTOP_SESSION=gnome \
    PIPER_GPL_PATH=/opt/piper1-gpl \
    PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True

# System dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    espeak-ng libespeak-ng-dev \
    ffmpeg \
    build-essential cmake ninja-build \
    git curl unzip \
    && rm -rf /var/lib/apt/lists/*

# Install deno for yt-dlp
RUN curl -fsSL https://deno.land/install.sh | sh

# Install piper1-gpl with training support
RUN pip install --no-cache-dir scikit-build && \
    git clone --depth 1 https://github.com/OHF-Voice/piper1-gpl.git /opt/piper1-gpl && \
    cd /opt/piper1-gpl && \
    pip install --no-cache-dir -e ".[train]" && \
    python3 setup.py build_ext --inplace && \
    bash build_monotonic_align.sh || true

WORKDIR /app

# Install Python dependencies (PyTorch already in base)
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

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "300"]
