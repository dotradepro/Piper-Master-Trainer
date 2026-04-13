import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { datasetsApi } from '@/api/datasets'
import type { DatasetInfo, DatasetStats, ValidationIssue, CsvRow } from '@/api/datasets'
import { formatDuration } from '@/lib/utils'
import { Database, Loader2, CheckCircle, AlertTriangle, XCircle, Info, BarChart3 } from 'lucide-react'

export function DatasetPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [stats, setStats] = useState<DatasetStats | null>(null)
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [preview, setPreview] = useState<CsvRow[]>([])
  const [previewTotal, setPreviewTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [minDur, setMinDur] = useState(1.0)
  const [maxDur, setMaxDur] = useState(15.0)
  const [sampleRate, setSampleRate] = useState(22050)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) loadData()
  }, [projectId])

  const loadData = async () => {
    if (!projectId) return
    try {
      const ds = await datasetsApi.list(projectId)
      setDatasets(ds)
      if (ds.length > 0) {
        await loadDatasetDetails(ds[0].id)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const loadDatasetDetails = async (id: string) => {
    const [s, v, p] = await Promise.all([
      datasetsApi.stats(id).catch(() => null),
      datasetsApi.validate(id).catch(() => []),
      datasetsApi.preview(id, 50).catch(() => ({ total: 0, rows: [] })),
    ])
    if (s) setStats(s)
    setIssues(v)
    setPreview(p.rows)
    setPreviewTotal(p.total)
  }

  const handlePrepare = async () => {
    if (!projectId) return
    setPreparing(true)
    setError(null)
    try {
      const ds = await datasetsApi.prepare(projectId, minDur, maxDur, sampleRate)
      setDatasets((prev) => [ds, ...prev])
      await loadDatasetDetails(ds.id)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Помилка підготовки датасету')
    } finally {
      setPreparing(false)
    }
  }

  const issueIcon = (level: string) => {
    switch (level) {
      case 'success': return <CheckCircle size={14} className="text-green-400" />
      case 'warning': return <AlertTriangle size={14} className="text-yellow-400" />
      case 'error': return <XCircle size={14} className="text-red-400" />
      default: return <Info size={14} className="text-blue-400" />
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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/20">
          <Database size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Датасет</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Підготовка навчального датасету для Piper</p>
        </div>
      </div>

      {/* Prepare Controls */}
      <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5 mb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-5 h-5 rounded bg-cyan-500/20 flex items-center justify-center"><Database size={10} className="text-cyan-400" /></div>
          <span className="text-sm font-semibold">Параметри підготовки</span>
        </div>
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Мін. тривалість (с)</label>
            <input type="number" value={minDur} onChange={(e) => setMinDur(+e.target.value)} step={0.5} min={0.5} max={10}
              className="w-24 px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm transition-smooth" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Макс. тривалість (с)</label>
            <input type="number" value={maxDur} onChange={(e) => setMaxDur(+e.target.value)} step={1} min={2} max={30}
              className="w-24 px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm transition-smooth" />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Sample Rate</label>
            <select value={sampleRate} onChange={(e) => setSampleRate(+e.target.value)}
              className="px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm transition-smooth">
              <option value={22050}>22050 Hz</option>
              <option value={16000}>16000 Hz</option>
            </select>
          </div>
          <button onClick={handlePrepare} disabled={preparing}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(160_71%_40%)] text-white text-sm font-semibold disabled:opacity-50 shadow-lg shadow-[hsl(var(--primary)/.25)] transition-smooth">
            {preparing ? <><Loader2 size={14} className="animate-spin" /> Підготовка...</> : <><Database size={14} /> Підготувати датасет</>}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 mb-4 text-sm text-red-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{error}
        </div>
      )}

      {/* Stats + Validation */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-5 h-5 rounded bg-cyan-500/20 flex items-center justify-center"><BarChart3 size={10} className="text-cyan-400" /></div>
              <h3 className="text-sm font-semibold">Статистика</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[hsl(var(--secondary)/.5)] p-3">
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Сегментів</div>
                <div className="text-lg font-bold mt-0.5">{stats.total_segments}</div>
              </div>
              <div className="rounded-xl bg-[hsl(var(--secondary)/.5)] p-3">
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Тривалість</div>
                <div className="text-lg font-bold mt-0.5">{formatDuration(stats.total_duration_sec)}</div>
              </div>
              <div className="rounded-xl bg-[hsl(var(--secondary)/.5)] p-3">
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Середня</div>
                <div className="text-lg font-bold mt-0.5">{stats.avg_duration_sec.toFixed(1)}с</div>
              </div>
              <div className="rounded-xl bg-[hsl(var(--secondary)/.5)] p-3">
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Мін / Макс</div>
                <div className="text-lg font-bold mt-0.5">{stats.min_duration_sec.toFixed(1)} / {stats.max_duration_sec.toFixed(1)}с</div>
              </div>
            </div>
            {/* Histogram */}
            {stats.duration_histogram.length > 0 && (
              <div className="mt-4">
                <div className="text-[11px] text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wider">Розподіл тривалості</div>
                <div className="flex items-end gap-0.5 h-14 p-2 rounded-xl bg-[hsl(var(--secondary)/.3)]">
                  {stats.duration_histogram.map((b, i) => {
                    const maxCount = Math.max(...stats.duration_histogram.map((x) => x.count))
                    const h = maxCount > 0 ? (b.count / maxCount) * 100 : 0
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center">
                        <div className="w-full bg-gradient-to-t from-cyan-500 to-cyan-400 rounded-t" style={{ height: `${h}%`, minHeight: b.count > 0 ? 2 : 0 }}
                          title={`${b.min}-${b.max}с: ${b.count}`} />
                      </div>
                    )
                  })}
                </div>
                <div className="flex justify-between text-[8px] text-[hsl(var(--muted-foreground))] mt-1">
                  <span>{stats.duration_histogram[0]?.min}с</span>
                  <span>{stats.duration_histogram[stats.duration_histogram.length - 1]?.max}с</span>
                </div>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5">
            <h3 className="text-sm font-semibold mb-4">Валідація</h3>
            <div className="space-y-2.5">
              {issues.map((issue, i) => (
                <div key={i} className="flex items-start gap-2.5 text-sm p-2.5 rounded-xl bg-[hsl(var(--secondary)/.3)] transition-smooth">
                  {issueIcon(issue.level)}
                  <span>{issue.message}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CSV Preview */}
      {preview.length > 0 && (
        <div className="rounded-2xl border border-[hsl(var(--border))] glass overflow-hidden">
          <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
            <h3 className="text-sm font-semibold">metadata.csv <span className="text-[hsl(var(--muted-foreground))] font-normal">({previewTotal} записів)</span></h3>
          </div>
          <div className="max-h-[50vh] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-[hsl(var(--secondary)/.5)] sticky top-0">
                <tr>
                  <th className="px-5 py-2.5 text-left text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider w-32">Файл</th>
                  <th className="px-5 py-2.5 text-left text-[11px] font-medium text-[hsl(var(--muted-foreground))] uppercase tracking-wider">Текст</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border)/.5)]">
                {preview.map((row, i) => (
                  <tr key={i} className="hover:bg-[hsl(var(--secondary)/.3)] transition-smooth">
                    <td className="px-5 py-2.5 text-[11px] font-mono text-[hsl(var(--muted-foreground))]">{row.filename}</td>
                    <td className="px-5 py-2.5">{row.text}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
