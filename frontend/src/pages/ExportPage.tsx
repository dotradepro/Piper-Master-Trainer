import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { trainingApi } from '@/api/training'
import { modelsApi } from '@/api/models'
import type { CheckpointInfo } from '@/api/training'
import type { ExportedModel } from '@/api/models'
import { formatBytes, formatDate } from '@/lib/utils'
import { Package, Loader2, Download } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

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
      toast.success('Модель успішно експортовано')
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Помилка експорту'
      setError(msg)
      toast.error(msg)
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

  const selectClasses = "h-10 w-full rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm"

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <Package size={24} className="text-[hsl(var(--foreground))]" />
        <div>
          <h1 className="text-xl font-bold">Експорт</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Конвертація в ONNX для Piper</p>
        </div>
      </div>

      {/* Export Controls */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Експорт чекпоінта</CardTitle>
        </CardHeader>
        <CardContent>
          {checkpoints.length === 0 ? (
            <div className="bg-[hsl(var(--muted))] rounded-md p-6 text-center">
              <Package size={32} className="mx-auto text-[hsl(var(--muted-foreground))] mb-3" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Немає чекпоінтів. Спочатку натренуйте модель.</p>
            </div>
          ) : (
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Checkpoint</label>
                <select value={selectedCkpt} onChange={(e) => setSelectedCkpt(e.target.value)}
                  className={selectClasses}>
                  {checkpoints.map((c) => (
                    <option key={c.path} value={c.path}>
                      {c.filename} ({c.size_mb.toFixed(0)} MB)
                    </option>
                  ))}
                </select>
              </div>
              <Button onClick={handleExport} disabled={exporting}>
                {exporting ? <><Loader2 size={14} className="animate-spin" /> Експорт...</> : <><Download size={14} /> Експортувати</>}
              </Button>
            </div>
          )}
          {exporting && (
            <div className="mt-3">
              <Progress className="h-2" />
            </div>
          )}
          {error && (
            <div className="mt-3 rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{error}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Exported Models */}
      {models.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Експортовані моделі <span className="text-[hsl(var(--muted-foreground))] font-normal">({models.length})</span></CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-[hsl(var(--border))]">
              {models.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <Package size={16} className="text-[hsl(var(--muted-foreground))] flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{m.onnx_path.split('/').pop()}</p>
                      <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                        {m.file_size_bytes ? <span>{formatBytes(m.file_size_bytes)}</span> : null}
                        <span>{formatDate(m.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <Badge variant="success">ONNX</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
