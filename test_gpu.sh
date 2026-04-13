#!/bin/bash
# Тест GPU транскрипції в Docker
set -e

echo "=== Piper Master Trainer - GPU Test ==="

# 1. Check GPU
echo "[1/4] Checking GPU..."
sudo docker compose exec backend python3 -c "
import torch
print(f'PyTorch: {torch.__version__}')
print(f'CUDA available: {torch.cuda.is_available()}')
if torch.cuda.is_available():
    print(f'GPU: {torch.cuda.get_device_name(0)}')
    print(f'VRAM: {torch.cuda.get_device_properties(0).total_mem / 1024**3:.1f} GB')
"

# 2. Check faster-whisper CUDA
echo ""
echo "[2/4] Checking faster-whisper CUDA..."
sudo docker compose exec backend python3 -c "
import ctranslate2
types = ctranslate2.get_supported_compute_types('cuda')
print(f'CUDA compute types: {types}')
"

# 3. Create project + download video
echo ""
echo "[3/4] Creating project..."
PROJECT=$(curl -s -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"name": "GPU Test", "language": "uk"}')
PID=$(echo "$PROJECT" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "Project: $PID"

echo "Downloading video..."
AUDIO=$(curl -s --max-time 300 -X POST http://localhost:8000/api/youtube/download \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": \"$PID\", \"url\": \"https://www.youtube.com/watch?v=ktObxpsBnOc\"}")
AID=$(echo "$AUDIO" | python3 -c "import sys,json;print(json.load(sys.stdin)['id'])")
echo "Audio file: $AID"

# 4. Transcribe with small model on GPU
echo ""
echo "[4/4] Transcribing with small model on GPU..."
time curl -s --max-time 600 -X POST http://localhost:8000/api/transcription/start \
  -H "Content-Type: application/json" \
  -d "{\"project_id\": \"$PID\", \"audio_file_id\": \"$AID\", \"model_size\": \"small\", \"language\": \"uk\"}" | \
  python3 -c "
import sys, json
data = json.load(sys.stdin)
if isinstance(data, list):
    print(f'SUCCESS: {len(data)} segments')
    for s in data[:3]:
        print(f'  [{s[\"start_time\"]:.1f}-{s[\"end_time\"]:.1f}] {s[\"text\"]}')
else:
    print(f'ERROR: {json.dumps(data, ensure_ascii=False)}')
"

echo ""
echo "=== Done ==="
