import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { modelsApi } from '@/api/models'
import type { ExportedModel } from '@/api/models'
import { formatBytes } from '@/lib/utils'
import { PlayCircle, Loader2, Volume2 } from 'lucide-react'

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
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Помилка синтезу')
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

  return (
    <div>
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-pink-400 flex items-center justify-center shadow-lg shadow-pink-500/20">
          <PlayCircle size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Тестування</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">Синтез мовлення та перевірка якості</p>
        </div>
      </div>

      {models.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(var(--border))] glass p-10 text-center">
          <PlayCircle size={48} className="mx-auto text-[hsl(var(--muted-foreground)/.4)] mb-4" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">Немає експортованих моделей. Спочатку експортуйте чекпоінт.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            {/* Synthesis */}
            <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-5 h-5 rounded bg-pink-500/20 flex items-center justify-center"><Volume2 size={10} className="text-pink-400" /></div>
                <span className="text-sm font-semibold">Синтез</span>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Модель</label>
                  <select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm transition-smooth">
                    {models.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.onnx_path.split('/').pop()} ({m.file_size_bytes ? formatBytes(m.file_size_bytes) : '?'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Текст</label>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
                    placeholder="Введіть текст українською..."
                    className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm resize-none transition-smooth" />
                </div>
                <button onClick={handleSynthesize} disabled={synthesizing || !text.trim()}
                  className="btn-primary w-full flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(160_71%_40%)] text-white text-sm font-semibold disabled:opacity-50 shadow-lg shadow-[hsl(var(--primary)/.25)] transition-smooth">
                  {synthesizing ? <><Loader2 size={14} className="animate-spin" /> Синтез...</> : <><Volume2 size={14} /> Синтезувати</>}
                </button>
                {error && (
                  <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-sm text-red-400 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{error}
                  </div>
                )}
              </div>

              {/* Player */}
              {audioUrl && (
                <div className="mt-4 p-4 rounded-xl bg-[hsl(var(--secondary)/.5)] border border-[hsl(var(--border)/.5)]">
                  <audio controls src={audioUrl} className="w-full h-8" />
                </div>
              )}
            </div>

            {/* History */}
            {history.length > 0 && (
              <div className="rounded-2xl border border-[hsl(var(--border))] glass overflow-hidden">
                <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
                  <span className="text-sm font-semibold">Історія</span>
                </div>
                <div className="divide-y divide-[hsl(var(--border)/.5)]">
                  {history.map((h, i) => (
                    <div key={i} className="px-5 py-3.5 hover:bg-[hsl(var(--secondary)/.3)] transition-smooth">
                      <p className="text-sm mb-2.5 text-[hsl(var(--muted-foreground))]">{h.text.slice(0, 100)}</p>
                      <audio controls src={h.url} className="w-full h-8" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5">
              <h3 className="text-sm font-semibold mb-4">Параметри синтезу</h3>
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
