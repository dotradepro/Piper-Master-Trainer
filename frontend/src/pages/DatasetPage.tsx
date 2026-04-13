import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { datasetsApi } from '@/api/datasets'
import type { DatasetInfo, DatasetStats, ValidationIssue, CsvRow } from '@/api/datasets'
import { formatDuration } from '@/lib/utils'
import { Database, Loader2, BarChart3 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'

export function DatasetPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [stats, setStats] = useState<DatasetStats | null>(null)
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [preview, setPreview] = useState<CsvRow[]>([])
  const [previewTotal, setPreviewTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [prepareProgress, setPrepareProgress] = useState(0)
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
    setPrepareProgress(15)
    try {
      setPrepareProgress(40)
      const ds = await datasetsApi.prepare(projectId, minDur, maxDur, sampleRate)
      setPrepareProgress(100)
      setDatasets((prev) => [ds, ...prev])
      await loadDatasetDetails(ds.id)
      toast.success('Датасет підготовлено успішно')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Помилка підготовки датасету')
      toast.error('Помилка підготовки датасету')
    } finally {
      setPreparing(false)
      setPrepareProgress(0)
    }
  }

  const severityVariant = (level: string): 'success' | 'warning' | 'destructive' | 'info' => {
    switch (level) {
      case 'success': return 'success'
      case 'warning': return 'warning'
      case 'error': return 'destructive'
      default: return 'info'
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
      <div className="flex items-center gap-3 mb-6">
        <Database size={20} />
        <div>
          <h1 className="text-lg font-semibold">Датасет</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Підготовка навчального датасету для Piper</p>
        </div>
      </div>

      {/* Prepare Controls */}
      <Card className="mb-4">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm">Параметри підготовки</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
            <div>
              <label>Мін. тривалість (с)</label>
              <input
                type="number"
                value={minDur}
                onChange={(e) => setMinDur(+e.target.value)}
                step={0.5}
                min={0.5}
                max={10}
              />
            </div>
            <div>
              <label>Макс. тривалість (с)</label>
              <input
                type="number"
                value={maxDur}
                onChange={(e) => setMaxDur(+e.target.value)}
                step={1}
                min={2}
                max={30}
              />
            </div>
            <div>
              <label>Sample Rate</label>
              <select
                value={sampleRate}
                onChange={(e) => setSampleRate(+e.target.value)}
              >
                <option value={22050}>22050 Hz</option>
                <option value={16000}>16000 Hz</option>
              </select>
            </div>
            <div className="flex justify-end">
              <Button onClick={handlePrepare} disabled={preparing}>
                {preparing ? <><Loader2 size={14} className="animate-spin" /> Підготовка...</> : <><Database size={14} /> Підготувати датасет</>}
              </Button>
            </div>
          </div>
          {preparing && prepareProgress > 0 && (
            <Progress value={prepareProgress} className="mt-3" />
          )}
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 p-3 mb-4 text-sm text-[hsl(var(--destructive))] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--destructive))]" />{error}
        </div>
      )}

      {/* Stats + Validation */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 mb-4">
          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 size={14} />
                Статистика
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-[hsl(var(--muted))] rounded-md p-3 text-center">
                  <div className="text-lg font-bold">{stats.total_segments}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">Сегментів</div>
                </div>
                <div className="bg-[hsl(var(--muted))] rounded-md p-3 text-center">
                  <div className="text-lg font-bold">{formatDuration(stats.total_duration_sec)}</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">Тривалість</div>
                </div>
                <div className="bg-[hsl(var(--muted))] rounded-md p-3 text-center">
                  <div className="text-lg font-bold">{stats.avg_duration_sec.toFixed(1)}с</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">Середня</div>
                </div>
                <div className="bg-[hsl(var(--muted))] rounded-md p-3 text-center">
                  <div className="text-lg font-bold">{stats.min_duration_sec.toFixed(1)} / {stats.max_duration_sec.toFixed(1)}с</div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">Мін / Макс</div>
                </div>
              </div>
              {/* Histogram */}
              {stats.duration_histogram.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs text-[hsl(var(--muted-foreground))] mb-2">Розподіл тривалості</div>
                  <div className="flex items-end gap-0.5 h-14 p-2 rounded-md bg-[hsl(var(--muted))]">
                    {stats.duration_histogram.map((b, i) => {
                      const maxCount = Math.max(...stats.duration_histogram.map((x) => x.count))
                      const h = maxCount > 0 ? (b.count / maxCount) * 100 : 0
                      return (
                        <div key={i} className="flex-1 flex flex-col items-center">
                          <div
                            className="w-full bg-[hsl(var(--foreground))] rounded-t"
                            style={{ height: `${h}%`, minHeight: b.count > 0 ? 2 : 0 }}
                            title={`${b.min}-${b.max}с: ${b.count}`}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <div className="flex justify-between text-xs text-[hsl(var(--muted-foreground))] mt-1">
                    <span>{stats.duration_histogram[0]?.min}с</span>
                    <span>{stats.duration_histogram[stats.duration_histogram.length - 1]?.max}с</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="px-4 py-3">
              <CardTitle className="text-sm">Валідація</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="space-y-2.5">
                {issues.map((issue, i) => (
                  <div key={i} className="flex items-start gap-2.5 text-sm p-2.5 rounded-md bg-[hsl(var(--muted))]">
                    <Badge variant={severityVariant(issue.level)} className="mt-0.5 shrink-0">
                      {issue.level}
                    </Badge>
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* CSV Preview */}
      {preview.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader className="px-4 py-3">
            <CardTitle className="text-sm">
              metadata.csv <span className="text-[hsl(var(--muted-foreground))] font-normal">({previewTotal} записів)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[50vh] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--muted))] sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] w-32">Файл</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">Текст</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {preview.map((row, i) => (
                    <tr key={i} className="hover:bg-[hsl(var(--muted))] transition-colors">
                      <td className="px-4 py-2 text-xs font-mono text-[hsl(var(--muted-foreground))]">{row.filename}</td>
                      <td className="px-4 py-2">{row.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
