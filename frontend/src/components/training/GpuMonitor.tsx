import { useGpuStatus } from '@/hooks/useGpuStatus'
import { Cpu } from 'lucide-react'

export function GpuMonitor() {
  const gpu = useGpuStatus()

  if (!gpu) {
    return (
      <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5">
        <div className="flex items-center gap-2 text-[hsl(var(--muted-foreground))]">
          <Cpu size={16} className="animate-pulse" />
          <span className="text-sm">GPU...</span>
        </div>
      </div>
    )
  }

  if (!gpu.available) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
        <div className="flex items-center gap-2 text-red-400">
          <Cpu size={16} />
          <span className="text-sm">{gpu.error}</span>
        </div>
      </div>
    )
  }

  const vramPercent = gpu.vram_total_mb
    ? Math.round((gpu.vram_used_mb! / gpu.vram_total_mb) * 100)
    : 0

  const barColor = vramPercent > 90 ? 'from-red-500 to-red-400' : vramPercent > 70 ? 'from-yellow-500 to-orange-400' : 'from-[hsl(var(--primary))] to-[hsl(160_71%_55%)]'

  return (
    <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5 glow-green">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(160_71%_40%)] flex items-center justify-center">
          <Cpu size={14} className="text-white" />
        </div>
        <div>
          <span className="text-xs font-semibold block">{gpu.name?.replace('NVIDIA GeForce ', '')}</span>
          <span className="text-[10px] text-[hsl(var(--muted-foreground))]">NVIDIA CUDA</span>
        </div>
      </div>

      {/* VRAM Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-[11px] text-[hsl(var(--muted-foreground))] mb-1.5">
          <span>VRAM</span>
          <span className="font-mono">
            {gpu.vram_used_mb} / {gpu.vram_total_mb} MB
          </span>
        </div>
        <div className="h-2 rounded-full bg-[hsl(var(--secondary))] overflow-hidden">
          <div
            className={`h-full rounded-full bg-gradient-to-r ${barColor} transition-all duration-500`}
            style={{ width: `${vramPercent}%` }}
          />
        </div>
        <div className="text-right text-[10px] text-[hsl(var(--muted-foreground))] mt-1">{vramPercent}%</div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Темп.', value: `${gpu.temperature_c}°C`, warn: (gpu.temperature_c || 0) > 80 },
          { label: 'GPU', value: `${gpu.utilization_pct}%`, warn: false },
          { label: 'Вт', value: `${gpu.power_watts?.toFixed(0)}W`, warn: false },
        ].map((stat) => (
          <div key={stat.label} className="text-center p-2 rounded-lg bg-[hsl(var(--secondary)/.5)]">
            <div className={`text-sm font-bold font-mono ${stat.warn ? 'text-orange-400' : ''}`}>
              {stat.value}
            </div>
            <div className="text-[10px] text-[hsl(var(--muted-foreground))]">{stat.label}</div>
          </div>
        ))}
      </div>

      {gpu.current_task && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-[hsl(var(--primary))]">
          <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] animate-pulse" />
          {gpu.current_task}
        </div>
      )}
    </div>
  )
}
