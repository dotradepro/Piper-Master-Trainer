#!/bin/bash
set -e

echo "╔══════════════════════════════════════════╗"
echo "║   Piper Master Trainer - Встановлення    ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# Перевірка Docker
if ! command -v docker &>/dev/null; then
    echo "[!] Docker не знайдено. Встановлюю..."
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker "$USER"
    echo "[+] Docker встановлено. Перезайдіть у сесію для активації групи docker."
fi

# Перевірка Docker Compose
if ! docker compose version &>/dev/null; then
    echo "[!] Docker Compose не знайдено."
    echo "    Встановіть: https://docs.docker.com/compose/install/"
    exit 1
fi

# Перевірка NVIDIA Docker runtime
if ! docker info 2>/dev/null | grep -q nvidia; then
    echo "[!] NVIDIA Container Toolkit не знайдено. Встановлюю..."
    distribution=$(. /etc/os-release; echo $ID$VERSION_ID)
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
    curl -s -L "https://nvidia.github.io/libnvidia-container/$distribution/libnvidia-container.list" | \
        sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
        sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
    sudo apt-get update
    sudo apt-get install -y nvidia-container-toolkit
    sudo nvidia-ctk runtime configure --runtime=docker
    sudo systemctl restart docker
    echo "[+] NVIDIA Container Toolkit встановлено."
fi

# Перевірка GPU
echo ""
echo "[*] Перевірка GPU..."
if nvidia-smi &>/dev/null; then
    GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1)
    GPU_VRAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -1)
    echo "[+] GPU: $GPU_NAME ($GPU_VRAM MB VRAM)"
else
    echo "[!] GPU не виявлено. Тренування буде на CPU (повільно)."
fi

# Експорт YouTube cookies (опціонально)
echo ""
COOKIES_FILE="backend/storage/cookies.txt"
if [ ! -f "$COOKIES_FILE" ]; then
    echo "[*] YouTube cookies не знайдено."
    echo "    Для завантаження age-restricted відео потрібні cookies."
    read -p "    Експортувати cookies з Chrome? (y/n): " export_cookies
    if [ "$export_cookies" = "y" ]; then
        mkdir -p backend/storage
        export XDG_CURRENT_DESKTOP=GNOME DESKTOP_SESSION=gnome
        if command -v python3.11 &>/dev/null; then
            PY=python3.11
        else
            PY=python3
        fi
        $PY -c "
import subprocess, sys
try:
    import yt_dlp
except ImportError:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', '-q', 'yt-dlp'])
    import yt_dlp
ydl_opts = {'quiet': True, 'cookiesfrombrowser': ('chrome',), 'cookiefile': '$COOKIES_FILE', 'simulate': True}
try:
    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        ydl.extract_info('https://www.youtube.com/watch?v=dQw4w9WgXcQ', download=False)
    print('[+] Cookies експортовано.')
except Exception as e:
    print(f'[!] Не вдалося: {e}')
" 2>/dev/null
    fi
else
    echo "[+] YouTube cookies знайдено."
fi

# Збірка та запуск
echo ""
echo "[*] Збірка Docker образів..."
sudo docker compose build

echo ""
echo "[*] Запуск сервісів..."
sudo docker compose up -d

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║          Встановлення завершено!          ║"
echo "╠══════════════════════════════════════════╣"
echo "║                                          ║"
echo "║  Frontend:  http://localhost              ║"
echo "║  API Docs:  http://localhost:8000/docs    ║"
echo "║                                          ║"
echo "╚══════════════════════════════════════════╝"
echo ""
sudo docker compose ps
