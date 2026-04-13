import { api } from './client'

export interface GpuStatus {
  available: boolean
  name?: string
  vram_used_mb?: number
  vram_total_mb?: number
  vram_free_mb?: number
  temperature_c?: number
  utilization_pct?: number
  power_watts?: number
  current_task?: string | null
  error?: string
}

export const systemApi = {
  gpuStatus: () => api.get<GpuStatus>('/system/gpu').then((r) => r.data),
  health: () => api.get('/health').then((r) => r.data),
}
