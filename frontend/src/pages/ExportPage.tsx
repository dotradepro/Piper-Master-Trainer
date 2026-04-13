import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { trainingApi } from '@/api/training'
import { modelsApi } from '@/api/models'
import type { CheckpointInfo } from '@/api/training'
import type { ExportedModel } from '@/api/models'
import { formatBytes, formatDate } from '@/lib/utils'
import { Package, Loader2, Download } from 'lucide-react'

export function ExportPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [checkpoints, setCheckpoints] = useState<CheckpointInfo[]>([])
  const [models, setModels] = useState<ExportedModel[]>([])
  const [selectedCkpt, setSelectedCkpt] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (projectId) loadData()
  }, [projectId])

  const loadData = async () => {
    if (!projectId) return
    try {
      const [ckpts, mdls] = await Promise.all([
        trainingApi.checkpoints(projectId),
        modelsApi.list(projectId),
      ])
      setCheckpoints(ckpts)
      setModels(mdls)
      if (ckpts.length > 0) setSelectedCkpt(ckpts[0].path)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!projectId || !selectedCkpt) return
    setExporting(true)
    setError(null)
    try {
      const model = await modelsApi.export(projectId, selectedCkpt)
      setModels((prev) => [model, ...prev])
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Помилка експорту')
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
        <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Завантаження...
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Package size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Експорт</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Конвертація в ONNX для Piper</p>
        </div>
      </div>

      {/* Export Controls */}
      <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-indigo-500/20 flex items-center justify-center"><Package size={10} className="text-indigo-400" /></div>
          <span className="text-sm font-semibold">Експорт чекпоінта</span>
        </div>
        {checkpoints.length === 0 ? (
          <div className="rounded-xl bg-[hsl(var(--secondary)/.3)] p-6 text-center">
            <Package size={32} className="mx-auto text-[hsl(var(--muted-foreground)/.4)] mb-3" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Немає чекпоінтів. Спочатку натренуйте модель.</p>
          </div>
        ) : (
          <div className="flex items-end gap-3">
            <div className="flex-1">
              <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Checkpoint</label>
              <select value={selectedCkpt} onChange={(e) => setSelectedCkpt(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm transition-smooth">
                {checkpoints.map((c) => (
                  <option key={c.path} value={c.path}>
                    {c.filename} ({c.size_mb.toFixed(0)} MB)
                  </option>
                ))}
              </select>
            </div>
            <button onClick={handleExport} disabled={exporting}
              className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(160_71%_40%)] text-white text-sm font-semibold disabled:opacity-50 shadow-lg shadow-[hsl(var(--primary)/.25)] transition-smooth">
              {exporting ? <><Loader2 size={14} className="animate-spin" /> Експорт...</> : <><Download size={14} /> Експортувати</>}
            </button>
          </div>
        )}
        {error && (
          <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{error}
          </div>
        )}
      </div>

      {/* Exported Models */}
      {models.length > 0 && (
        <div className="rounded-2xl border border-[hsl(var(--border))] glass overflow-hidden">
          <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
            <h2 className="text-sm font-semibold">Експортовані моделі <span className="text-[hsl(var(--muted-foreground))] font-normal">({models.length})</span></h2>
          </div>
          <div className="divide-y divide-[hsl(var(--border)/.5)]">
            {models.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-[hsl(var(--secondary)/.3)] transition-smooth group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/15 to-indigo-500/5 flex items-center justify-center text-indigo-400 flex-shrink-0">
                    <Package size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{m.onnx_path.split('/').pop()}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                      {m.file_size_bytes ? <span>{formatBytes(m.file_size_bytes)}</span> : null}
                      <span>{formatDate(m.created_at)}</span>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-green-400 px-2.5 py-1 rounded-lg bg-green-400/10 uppercase tracking-wider">ONNX</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
