import { useGpuStatus } from '@/hooks/useGpuStatus'
import { Cpu } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'

export function GpuMonitor() {
  const gpu = useGpuStatus()

  if (!gpu) {
    return (
      <Card>
        <CardContent className="py-5">
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
        <CardContent className="py-5">
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
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Cpu size={16} />
          <div>
            <span className="block">{gpu.name?.replace('NVIDIA GeForce ', '')}</span>
            <span className="text-[10px] text-[hsl(var(--muted-foreground))] font-normal">NVIDIA CUDA</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* VRAM Bar */}
        <div>
          <div className="flex justify-between text-[11px] text-[hsl(var(--muted-foreground))] mb-1.5">
            <span>VRAM</span>
            <span className="font-mono">
              {gpu.vram_used_mb} / {gpu.vram_total_mb} MB
            </span>
          </div>
          <Progress value={vramPercent} className="h-2" />
          <div className="text-right text-[10px] text-[hsl(var(--muted-foreground))] mt-1">{vramPercent}%</div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Темп.', value: `${gpu.temperature_c}\u00B0C`, warn: (gpu.temperature_c || 0) > 80 },
            { label: 'GPU', value: `${gpu.utilization_pct}%`, warn: false },
            { label: 'Вт', value: `${gpu.power_watts?.toFixed(0)}W`, warn: false },
          ].map((stat) => (
            <div key={stat.label} className="text-center bg-[hsl(var(--muted))] rounded-md p-2">
              <div className={`text-sm font-bold font-mono ${stat.warn ? 'text-orange-400' : ''}`}>
                {stat.value}
              </div>
              <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{stat.label}</div>
            </div>
          ))}
        </div>

        {gpu.current_task && (
          <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--primary))]">
            <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" />
            {gpu.current_task}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
