# Piper Master Trainer

Веб-додаток для тренування голосових моделей [Piper TTS](https://github.com/OHF-Voice/piper1-gpl). Повний пайплайн від завантаження аудіо до синтезу мовлення.

## Можливості

- **Завантаження аудіо** з YouTube (включаючи age-restricted) або локальних файлів
- **Транскрипція** через faster-whisper на GPU з редагуванням сегментів
- **Підготовка датасету** з нормалізацією, фільтрацією та валідацією
- **Тренування VITS** моделі з нуля або fine-tuning на GPU
- **Експорт в ONNX** для використання з Piper
- **Тестування** синтезу мовлення з регулюванням параметрів
- **GPU моніторинг** VRAM, температури, утилізації в реальному часі

## Стек технологій

| Компонент | Технологія |
|-----------|-----------|
| Backend | FastAPI, SQLAlchemy, SQLite |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| TTS | piper1-gpl (VITS), PyTorch, ONNX |
| Транскрипція | faster-whisper (CTranslate2) |
| GPU | NVIDIA CUDA 12.1, Docker nvidia runtime |
| Інфраструктура | Docker Compose, Redis |

## Вимоги

- **GPU**: NVIDIA з CUDA (тестовано на RTX 3050 Ti 4GB)
- **Docker** з nvidia-container-toolkit
- **Chrome** (опціонально, для cookies YouTube)

## Швидкий старт

```bash
# Клонування
git clone https://github.com/your-repo/Piper-Master-Trainer.git
cd Piper-Master-Trainer

# Автоматичне встановлення (Docker, NVIDIA toolkit, збірка, запуск)
bash install.sh

# Або вручну:
sudo docker compose build
sudo docker compose up -d

# Відкрити в браузері
# Frontend: http://localhost
# Backend API: http://localhost:8000/docs
```

## Розробка (без Docker)

```bash
# Backend
cd backend
uv venv .venv --python 3.11
source .venv/bin/activate
uv pip install -e ".[dev]"
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev  # http://localhost
```

## Пайплайн тренування

```
1. Створити проєкт (мова, назва)
2. Завантажити аудіо (YouTube URL або файл)
3. Транскрибувати (Whisper small/medium на GPU)
4. Відредагувати сегменти (текст, включення)
5. Підготувати датасет (metadata.csv + WAV)
6. Запустити тренування (batch_size=2 для 4GB VRAM)
7. Експортувати checkpoint в ONNX
8. Тестувати синтез мовлення
```

## Налаштування для RTX 3050 (4GB VRAM)

| Параметр | Значення |
|----------|----------|
| batch_size | 2 |
| precision | FP32 |
| Whisper модель | small (макс. medium) |
| VRAM під час тренування | ~3.1 GB |

## API

| Ендпоінт | Опис |
|----------|------|
| `POST /api/projects` | Створити проєкт |
| `POST /api/youtube/download` | Завантажити аудіо з YouTube |
| `POST /api/transcription/start` | Транскрибувати аудіо |
| `POST /api/datasets/prepare` | Підготувати датасет |
| `POST /api/training/start` | Запустити тренування |
| `POST /api/training/stop` | Зупинити тренування |
| `POST /api/models/export` | Експорт в ONNX |
| `POST /api/models/synthesize` | Синтез мовлення |
| `GET /api/system/gpu` | Стан GPU |

## Структура проєкту

```
├── docker-compose.yml          # Docker стек
├── docker/                     # Dockerfiles
├── backend/
│   ├── app/
│   │   ├── main.py             # FastAPI додаток
│   │   ├── routers/            # API ендпоінти
│   │   ├── services/           # Бізнес-логіка
│   │   ├── models/             # SQLAlchemy ORM
│   │   ├── schemas/            # Pydantic валідація
│   │   └── utils/              # piper_bridge, GPU manager
│   └── storage/                # Дані проєктів
└── frontend/
    └── src/
        ├── pages/              # Сторінки пайплайну
        ├── components/         # UI компоненти
        └── api/                # API клієнт
```

## Ліцензія

Базується на [piper1-gpl](https://github.com/OHF-Voice/piper1-gpl) (GPL-3.0).
