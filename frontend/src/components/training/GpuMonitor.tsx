import { useGpuStatus } from '@/hooks/useGpuStatus'
import { Cpu } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export function GpuMonitor() {
  const gpu = useGpuStatus()

  if (!gpu) {
    return (
      <Card>
        <CardContent className="px-4 pb-4 pt-3">
          <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
            <Cpu size={16} className="animate-pulse" />
            <span className="text-sm">GPU...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!gpu.available) {
    return (
      <Card className="border-red-500/20 bg-red-500/5">
        <CardContent className="px-4 pb-4 pt-3">
          <div className="flex items-center gap-2 text-red-400">
            <Cpu size={16} />
            <span className="text-sm">{gpu.error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  const vramPercent = gpu.vram_total_mb
    ? Math.round((gpu.vram_used_mb! / gpu.vram_total_mb) * 100)
    : 0

  return (
    <Card>
      <CardContent className="px-4 pb-4 pt-3 space-y-3">
        {/* Header */}
        <div className="flex items-center gap-2">
          <Cpu size={16} />
          <div>
            <span className="text-sm font-medium block">{gpu.name?.replace('NVIDIA GeForce ', '')}</span>
            <span className="text-xs text-[hsl(var(--muted-foreground))]">NVIDIA CUDA</span>
          </div>
        </div>

        {/* VRAM Bar */}
        <div>
          <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))] mb-1">
            <span>VRAM</span>
            <span className="font-mono">{gpu.vram_used_mb} / {gpu.vram_total_mb} MB ({vramPercent}%)</span>
          </div>
          <Progress value={vramPercent} className="h-2" />
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
          <span className={`font-mono ${(gpu.temperature_c || 0) > 80 ? 'text-orange-400' : ''}`}>
            {gpu.temperature_c}{'\u00B0'}C
          </span>
          <span className="font-mono">{gpu.utilization_pct}% GPU</span>
          <span className="font-mono">{gpu.power_watts?.toFixed(0)}W</span>
        </div>

        {gpu.current_task && (
          <div className="flex items-center gap-2 text-xs text-[hsl(var(--primary))]">
            <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" />
            {gpu.current_task}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
