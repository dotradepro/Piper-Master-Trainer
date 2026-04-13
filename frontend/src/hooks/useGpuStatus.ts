import { useState, useEffect } from 'react'
import type { GpuStatus } from '@/api/system'
import { systemApi } from '@/api/system'

export function useGpuStatus(intervalMs = 5000) {
  const [gpu, setGpu] = useState<GpuStatus | null>(null)

  useEffect(() => {
    let active = true

    const fetch = async () => {
      try {
        const status = await systemApi.gpuStatus()
        if (active) setGpu(status)
      } catch {
        if (active) setGpu({ available: false, error: 'Не вдалося отримати стан GPU' })
      }
    }

    fetch()
    const id = setInterval(fetch, intervalMs)
    return () => {
      active = false
      clearInterval(id)
    }
  }, [intervalMs])

  return gpu
}
