import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { trainingApi } from '@/api/training'
import { datasetsApi } from '@/api/datasets'
import type { TrainingStatus, CheckpointInfo } from '@/api/training'
import type { DatasetInfo } from '@/api/datasets'
import { GpuMonitor } from '@/components/training/GpuMonitor'
import { formatDuration, formatBytes } from '@/lib/utils'
import { Brain, Play, Square, Loader2, Download, BarChart3 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

export function TrainingPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [selectedDataset, setSelectedDataset] = useState<string>('')
  const [status, setStatus] = useState<TrainingStatus | null>(null)
  const [checkpoints, setCheckpoints] = useState<CheckpointInfo[]>([])
  const [metricsHistory, setMetricsHistory] = useState<{ epoch: number; loss_g?: number; loss_d?: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  // Config
  const [batchSize, setBatchSize] = useState(4)
  const [maxEpochs, setMaxEpochs] = useState(10000)
  const [precision, setPrecision] = useState('32')
  const [accumGrad, setAccumGrad] = useState(8)
  const [mode, setMode] = useState<'scratch' | 'finetune'>('scratch')

  useEffect(() => {
    if (projectId) loadData()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [projectId])

  const loadData = async () => {
    if (!projectId) return
    try {
      const [ds, st, ckpts] = await Promise.all([
        datasetsApi.list(projectId),
        trainingApi.status(),
        trainingApi.checkpoints(projectId),
      ])
      setDatasets(ds)
      if (ds.length > 0) setSelectedDataset(ds[0].id)
      setStatus(st)
      setCheckpoints(ckpts)
      if (st.active) startPolling()
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const startPolling = () => {
    if (pollRef.current) return
    pollRef.current = window.setInterval(async () => {
      try {
        const st = await trainingApi.status()
        setStatus(st)
        if (st.metrics.epoch !== undefined) {
          setMetricsHistory((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.epoch === st.metrics.epoch) return prev
            return [...prev.slice(-200), { epoch: st.metrics.epoch, loss_g: st.metrics.loss_g, loss_d: st.metrics.loss_d }]
          })
        }
        if (!st.active) {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          if (projectId) {
            const ckpts = await trainingApi.checkpoints(projectId)
            setCheckpoints(ckpts)
          }
        }
      } catch {
      }
    }, 3000)
  }

  const handleStart = async () => {
    if (!projectId || !selectedDataset) return
    setStarting(true)
    setError(null)
    setMetricsHistory([])
    try {
      await trainingApi.start({
        project_id: projectId,
        dataset_id: selectedDataset,
        mode,
        batch_size: batchSize,
        max_epochs: maxEpochs,
        precision,
        accumulate_grad_batches: accumGrad,
      })
      const st = await trainingApi.status()
      setStatus(st)
      startPolling()
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Помилка запуску')
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async () => {
    try {
      await trainingApi.stop()
      const st = await trainingApi.status()
      setStatus(st)
    } catch {
    }
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [status?.log_lines])

  if (loading) {
    return (
      <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
        <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Завантаження...
      </div>
    )
  }

  const isActive = status?.active ?? false

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-400 flex items-center justify-center shadow-lg shadow-orange-500/20">
          <Brain size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Тренування</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">VITS модель на GPU</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {/* Config */}
          <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center"><Brain size={10} className="text-orange-400" /></div>
              <span className="text-sm font-semibold">Конфігурація</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Датасет</label>
                <select value={selectedDataset} onChange={(e) => setSelectedDataset(e.target.value)} disabled={isActive}
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm disabled:opacity-50 transition-smooth">
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>{d.total_segments} seg, {formatDuration(d.total_duration)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Режим</label>
                <select value={mode} onChange={(e) => setMode(e.target.value as 'scratch' | 'finetune')} disabled={isActive}
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm disabled:opacity-50 transition-smooth">
                  <option value="scratch">З нуля</option>
                  <option value="finetune">Fine-tune</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Batch size</label>
                <input type="number" value={batchSize} onChange={(e) => setBatchSize(+e.target.value)} min={1} max={32} disabled={isActive}
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm disabled:opacity-50 transition-smooth" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Макс. епох</label>
                <input type="number" value={maxEpochs} onChange={(e) => setMaxEpochs(+e.target.value)} min={10} step={100} disabled={isActive}
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm disabled:opacity-50 transition-smooth" />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Precision</label>
                <select value={precision} onChange={(e) => setPrecision(e.target.value)} disabled={isActive}
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm disabled:opacity-50 transition-smooth">
                  <option value="32">FP32</option>
                  <option value="16-mixed">FP16 Mixed</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Grad Accum</label>
                <input type="number" value={accumGrad} onChange={(e) => setAccumGrad(+e.target.value)} min={1} max={32} disabled={isActive}
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm disabled:opacity-50 transition-smooth" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              {!isActive ? (
                <button onClick={handleStart} disabled={starting || !selectedDataset || datasets.length === 0}
                  className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(160_71%_40%)] text-white text-sm font-semibold disabled:opacity-50 shadow-lg shadow-[hsl(var(--primary)/.25)] transition-smooth">
                  {starting ? <><Loader2 size={14} className="animate-spin" /> Запуск...</> : <><Play size={14} /> Почати тренування</>}
                </button>
              ) : (
                <button onClick={handleStop}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:opacity-90 shadow-lg shadow-red-500/20 transition-smooth">
                  <Square size={14} /> Зупинити
                </button>
              )}
            </div>
            {error && (
              <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{error}
              </div>
            )}
          </div>

          {/* Metrics Chart */}
          {metricsHistory.length > 1 && (
            <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center"><BarChart3 size={10} className="text-orange-400" /></div>
                <span className="text-sm font-semibold">Loss</span>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={metricsHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="epoch" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', fontSize: 12, borderRadius: 12 }} />
                  <Line type="monotone" dataKey="loss_g" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Generator" />
                  <Line type="monotone" dataKey="loss_d" stroke="#f97316" strokeWidth={1.5} dot={false} name="Discriminator" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Current Metrics */}
          {isActive && status?.metrics && Object.keys(status.metrics).length > 0 && (
            <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5">
              <div className="grid grid-cols-4 gap-3">
                {status.metrics.epoch !== undefined && (
                  <div className="rounded-xl bg-[hsl(var(--secondary)/.5)] p-3">
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Epoch</div>
                    <div className="font-mono font-bold text-lg mt-0.5">{status.metrics.epoch}</div>
                  </div>
                )}
                {status.metrics.step !== undefined && (
                  <div className="rounded-xl bg-[hsl(var(--secondary)/.5)] p-3">
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Step</div>
                    <div className="font-mono font-bold text-lg mt-0.5">{status.metrics.step}</div>
                  </div>
                )}
                {status.metrics.loss_g !== undefined && (
                  <div className="rounded-xl bg-[hsl(var(--secondary)/.5)] p-3">
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Loss G</div>
                    <div className="font-mono font-bold text-lg mt-0.5 text-green-400">{status.metrics.loss_g.toFixed(3)}</div>
                  </div>
                )}
                {status.metrics.loss_d !== undefined && (
                  <div className="rounded-xl bg-[hsl(var(--secondary)/.5)] p-3">
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Loss D</div>
                    <div className="font-mono font-bold text-lg mt-0.5 text-orange-400">{status.metrics.loss_d.toFixed(3)}</div>
                  </div>
                )}
              </div>
              <div className="text-[11px] text-[hsl(var(--muted-foreground))] mt-3 uppercase tracking-wider">
                Час: {formatDuration(status.elapsed_seconds)}
              </div>
            </div>
          )}

          {/* Log */}
          {status && status.log_lines.length > 0 && (
            <div className="rounded-2xl border border-[hsl(var(--border))] glass overflow-hidden">
              <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
                <span className="text-sm font-semibold">Лог</span>
              </div>
              <div ref={logRef} className="p-4 max-h-48 overflow-y-auto font-mono text-xs text-[hsl(var(--muted-foreground))] space-y-0.5">
                {status.log_lines.map((line, i) => (
                  <div key={i} className={line.includes('ERROR') ? 'text-red-400' : line.includes('Epoch') ? 'text-green-400' : ''}>{line}</div>
                ))}
              </div>
            </div>
          )}

          {/* Checkpoints */}
          {checkpoints.length > 0 && (
            <div className="rounded-2xl border border-[hsl(var(--border))] glass overflow-hidden">
              <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
                <h2 className="text-sm font-semibold">Чекпоінти <span className="text-[hsl(var(--muted-foreground))] font-normal">({checkpoints.length})</span></h2>
              </div>
              <div className="divide-y divide-[hsl(var(--border)/.5)]">
                {checkpoints.slice(0, 10).map((ckpt, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-[hsl(var(--secondary)/.3)] transition-smooth">
                    <span className="font-mono text-xs">{ckpt.filename}</span>
                    <span className="text-[11px] text-[hsl(var(--muted-foreground))]">{ckpt.size_mb.toFixed(1)} MB</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <GpuMonitor />
          {datasets.length === 0 && (
            <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm text-yellow-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              Спочатку підготуйте датасет на кроці "Датасет"
            </div>
          )}
          <div className="rounded-2xl border border-[hsl(var(--border))] glass p-4">
            <div className="text-sm font-semibold mb-3">RTX 3050 рекомендації</div>
            <div className="space-y-2 text-xs text-[hsl(var(--muted-foreground))]">
              <div className="flex justify-between p-2 rounded-xl bg-[hsl(var(--secondary)/.3)]">
                <span>Batch size</span><span className="font-mono text-[hsl(var(--foreground))]">4</span>
              </div>
              <div className="flex justify-between p-2 rounded-xl bg-[hsl(var(--secondary)/.3)]">
                <span>Precision</span><span className="font-mono text-[hsl(var(--foreground))]">FP32 (FP16 якщо OOM)</span>
              </div>
              <div className="flex justify-between p-2 rounded-xl bg-[hsl(var(--secondary)/.3)]">
                <span>Grad accumulation</span><span className="font-mono text-[hsl(var(--foreground))]">8</span>
              </div>
              <div className="flex justify-between p-2 rounded-xl bg-[hsl(var(--primary)/.1)]">
                <span>Ефективний batch</span><span className="font-mono font-semibold text-[hsl(var(--primary))]">{batchSize * accumGrad}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
