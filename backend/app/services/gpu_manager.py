import subprocess
import threading


class GpuManager:
    _lock = threading.Lock()
    _current_task: str | None = None

    def get_status(self) -> dict:
        try:
            result = subprocess.run(
                [
                    "nvidia-smi",
                    "--query-gpu=name,memory.used,memory.total,memory.free,temperature.gpu,utilization.gpu,power.draw",
                    "--format=csv,noheader,nounits",
                ],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode != 0:
                return {"available": False, "error": "nvidia-smi failed"}

            parts = [p.strip() for p in result.stdout.strip().split(",")]
            return {
                "available": True,
                "name": parts[0],
                "vram_used_mb": int(float(parts[1])),
                "vram_total_mb": int(float(parts[2])),
                "vram_free_mb": int(float(parts[3])),
                "temperature_c": int(float(parts[4])),
                "utilization_pct": int(float(parts[5])),
                "power_watts": float(parts[6]),
                "current_task": self._current_task,
            }
        except FileNotFoundError:
            return {"available": False, "error": "nvidia-smi not found"}
        except Exception as e:
            return {"available": False, "error": str(e)}

    def get_free_vram_mb(self) -> int:
        status = self.get_status()
        return status.get("vram_free_mb", 0)

    def check_vram_available(self, min_required_mb: int = 3500) -> bool:
        return self.get_free_vram_mb() >= min_required_mb

    def acquire_gpu(self, task_id: str) -> bool:
        with self._lock:
            if self._current_task is not None:
                return False
            self._current_task = task_id
            return True

    def release_gpu(self, task_id: str) -> None:
        with self._lock:
            if self._current_task == task_id:
                self._current_task = None

    def estimate_batch_size(self, available_vram_mb: int) -> int:
        if available_vram_mb >= 20000:
            return 32
        elif available_vram_mb >= 10000:
            return 16
        elif available_vram_mb >= 6000:
            return 8
        elif available_vram_mb >= 3500:
            return 4
        else:
            return 2
