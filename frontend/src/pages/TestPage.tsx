import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { modelsApi } from '@/api/models'
import type { ExportedModel } from '@/api/models'
import { formatBytes } from '@/lib/utils'
import { PlayCircle, Loader2, Volume2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'

export function TestPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [models, setModels] = useState<ExportedModel[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [text, setText] = useState('Привіт, це тестове повідомлення для перевірки якості голосової моделі.')
  const [lengthScale, setLengthScale] = useState(1.0)
  const [noiseScale, setNoiseScale] = useState(0.667)
  const [noiseW, setNoiseW] = useState(0.8)
  const [synthesizing, setSynthesizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [history, setHistory] = useState<{ text: string; url: string }[]>([])
  const [loading, setLoading] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (projectId) loadData()
    return () => { history.forEach((h) => URL.revokeObjectURL(h.url)) }
  }, [projectId])

  const loadData = async () => {
    if (!projectId) return
    try {
      const mdls = await modelsApi.list(projectId)
      setModels(mdls)
      if (mdls.length > 0) setSelectedModel(mdls[0].id)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleSynthesize = async () => {
    if (!selectedModel || !text.trim()) return
    setSynthesizing(true)
    setError(null)
    try {
      const blob = await modelsApi.synthesize(selectedModel, text.trim(), {
        length_scale: lengthScale,
        noise_scale: noiseScale,
        noise_w: noiseW,
      })
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      setHistory((prev) => [{ text: text.trim(), url }, ...prev.slice(0, 9)])

      // Auto-play
      const audio = new Audio(url)
      audio.play()
      audioRef.current = audio
      toast.success('Синтез завершено')
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Помилка синтезу'
      setError(msg)
      toast.error(msg)
    } finally {
      setSynthesizing(false)
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
        <PlayCircle size={24} className="text-[hsl(var(--foreground))]" />
        <div>
          <h1 className="text-xl font-bold">Тестування</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Синтез мовлення та перевірка якості</p>
        </div>
      </div>

      {models.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <PlayCircle size={48} className="mx-auto text-[hsl(var(--muted-foreground))] mb-4" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Немає експортованих моделей. Спочатку експортуйте чекпоінт.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {/* Synthesis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 size={16} /> Синтез
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Модель</label>
                    <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
                      className={selectClasses}>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.onnx_path.split('/').pop()} ({m.file_size_bytes ? formatBytes(m.file_size_bytes) : '?'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Текст</label>
                    <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
                      placeholder="Введіть текст українською..." />
                  </div>
                  <Button onClick={handleSynthesize} disabled={synthesizing || !text.trim()} className="w-full">
                    {synthesizing ? <><Loader2 size={14} className="animate-spin" /> Синтез...</> : <><Volume2 size={14} /> Синтезувати</>}
                  </Button>
                  {error && (
                    <div className="rounded-md border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{error}
                    </div>
                  )}
                </div>

                {/* Player */}
                {audioUrl && (
                  <div className="mt-4 bg-[hsl(var(--muted))] rounded-md p-3">
                    <audio controls src={audioUrl} className="w-full h-8" />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* History */}
            {history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Історія</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-[hsl(var(--border))]">
                    {history.map((h, i) => (
                      <div key={i} className="px-6 py-3.5">
                        <p className="text-sm mb-2.5 text-[hsl(var(--muted-foreground))]">{h.text.slice(0, 100)}</p>
                        <audio controls src={h.url} className="w-full h-8" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Параметри синтезу</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <label className="flex justify-between text-[11px] text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wider">
                      <span>Швидкість</span><span className="font-mono text-[hsl(var(--foreground))]">{lengthScale.toFixed(1)}</span>
                    </label>
                    <input type="range" min={0.5} max={2.0} step={0.1} value={lengthScale}
                      onChange={(e) => setLengthScale(+e.target.value)} className="w-full" />
                  </div>
                  <div>
                    <label className="flex justify-between text-[11px] text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wider">
                      <span>Noise Scale</span><span className="font-mono text-[hsl(var(--foreground))]">{noiseScale.toFixed(2)}</span>
                    </label>
                    <input type="range" min={0} max={1} step={0.05} value={noiseScale}
                      onChange={(e) => setNoiseScale(+e.target.value)} className="w-full" />
                  </div>
                  <div>
                    <label className="flex justify-between text-[11px] text-[hsl(var(--muted-foreground))] mb-2 uppercase tracking-wider">
                      <span>Noise W</span><span className="font-mono text-[hsl(var(--foreground))]">{noiseW.toFixed(2)}</span>
                    </label>
                    <input type="range" min={0} max={1} step={0.05} value={noiseW}
                      onChange={(e) => setNoiseW(+e.target.value)} className="w-full" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
