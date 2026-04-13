import { useGpuStatus } from '@/hooks/useGpuStatus'
import { Cpu } from 'lucide-react'
import BSCard from 'react-bootstrap/Card'
import ProgressBar from 'react-bootstrap/ProgressBar'

export function GpuMonitor() {
  const gpu = useGpuStatus()

  if (!gpu) return (
    <BSCard className="mb-3">
      <BSCard.Body className="py-3 text-muted d-flex align-items-center gap-2">
        <Cpu size={16} className="opacity-50" /> GPU...
      </BSCard.Body>
    </BSCard>
  )

  if (!gpu.available) return (
    <BSCard border="danger" className="mb-3">
      <BSCard.Body className="py-3 text-danger d-flex align-items-center gap-2">
        <Cpu size={16} /> {gpu.error}
      </BSCard.Body>
    </BSCard>
  )

  const pct = gpu.vram_total_mb ? Math.round((gpu.vram_used_mb! / gpu.vram_total_mb) * 100) : 0
  const variant = pct > 90 ? 'danger' : pct > 70 ? 'warning' : 'success'

  return (
    <BSCard className="mb-3">
      <BSCard.Body className="py-3">
        <div className="d-flex align-items-center gap-2 mb-2">
          <Cpu size={14} />
          <small className="fw-semibold">{gpu.name?.replace('NVIDIA GeForce ', '')}</small>
        </div>
        <div className="d-flex justify-content-between mb-1">
          <small className="text-muted">VRAM</small>
          <small className="text-muted font-monospace">{gpu.vram_used_mb}/{gpu.vram_total_mb} MB ({pct}%)</small>
        </div>
        <ProgressBar now={pct} variant={variant} style={{ height: 6 }} />
        <div className="d-flex gap-3 mt-2">
          <small className="text-muted">{gpu.temperature_c}°C</small>
          <small className="text-muted">{gpu.utilization_pct}%</small>
          <small className="text-muted">{gpu.power_watts?.toFixed(0)}W</small>
        </div>
      </BSCard.Body>
    </BSCard>
  )
}
