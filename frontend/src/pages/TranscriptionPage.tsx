import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { transcriptionApi } from '@/api/transcription'
import { youtubeApi, getAudioUrl } from '@/api/youtube'
import type { Segment } from '@/api/transcription'
import type { AudioFile } from '@/api/youtube'
import { formatDuration } from '@/lib/utils'
import {
  FileAudio,
  Play,
  Pause,
  Loader2,
  Check,
  X,
  Trash2,
  Merge,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

export function TranscriptionPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [transcribing, setTranscribing] = useState(false)
  const [transcribeProgress, setTranscribeProgress] = useState(0)
  const [modelSize, setModelSize] = useState('small')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (projectId) loadData()
  }, [projectId])

  const loadData = async () => {
    if (!projectId) return
    try {
      const [files, segs] = await Promise.all([
        youtubeApi.listFiles(projectId),
        transcriptionApi.getSegments(projectId),
      ])
      setAudioFiles(files)
      setSegments(segs)
      if (files.length > 0) setSelectedFile(files[0].id)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  const handleTranscribe = async () => {
    if (!projectId || !selectedFile) return
    setTranscribing(true)
    setTranscribeProgress(15)
    try {
      setTranscribeProgress(40)
      const segs = await transcriptionApi.start(projectId, selectedFile, modelSize)
      setTranscribeProgress(100)
      setSegments(segs)
      toast.success(`Транскрипцію завершено: ${segs.length} сегментів`)
    } catch (e: any) {
      toast.error(e.response?.data?.detail || 'Помилка транскрипції')
    } finally {
      setTranscribing(false)
      setTranscribeProgress(0)
    }
  }

  const handleSave = async (segId: string) => {
    try {
      const updated = await transcriptionApi.updateSegment(segId, { text: editText })
      setSegments((prev) => prev.map((s) => (s.id === segId ? updated : s)))
      setEditingId(null)
    } catch {
      // ignore
    }
  }

  const handleToggle = async (seg: Segment) => {
    try {
      const updated = await transcriptionApi.updateSegment(seg.id, { included: !seg.included })
      setSegments((prev) => prev.map((s) => (s.id === seg.id ? updated : s)))
    } catch {
      // ignore
    }
  }

  const handleDelete = async (segId: string) => {
    try {
      await transcriptionApi.deleteSegment(segId)
      setSegments((prev) => prev.filter((s) => s.id !== segId))
      setSelectedIds((prev) => {
        const n = new Set(prev)
        n.delete(segId)
        return n
      })
    } catch {
      // ignore
    }
  }

  const handleMerge = async () => {
    if (selectedIds.size < 2) return
    try {
      const merged = await transcriptionApi.mergeSegments([...selectedIds])
      setSegments((prev) => {
        const filtered = prev.filter((s) => !selectedIds.has(s.id))
        return [...filtered, merged].sort((a, b) => a.start_time - b.start_time)
      })
      setSelectedIds(new Set())
      toast.success('Сегменти об\'єднано')
    } catch {
      // ignore
    }
  }

  const playSegment = (seg: Segment) => {
    const file = audioFiles.find((f) => f.id === seg.audio_file_id)
    if (!file) return

    if (playingId === seg.id) {
      audioRef.current?.pause()
      setPlayingId(null)
      return
    }

    if (audioRef.current) audioRef.current.pause()

    const audio = new Audio(getAudioUrl(file.file_path))
    audio.currentTime = seg.start_time
    audio.onended = () => setPlayingId(null)
    audio.ontimeupdate = () => {
      if (audio.currentTime >= seg.end_time) {
        audio.pause()
        setPlayingId(null)
      }
    }
    audio.play()
    audioRef.current = audio
    setPlayingId(seg.id)
  }

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  const includedSegments = segments.filter((s) => s.included)
  const totalDuration = includedSegments.reduce((acc, s) => acc + (s.end_time - s.start_time), 0)

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
        <FileAudio size={24} className="text-[hsl(var(--foreground))]" />
        <div>
          <h1 className="text-xl font-bold">Транскрипція</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Розпізнавання мовлення через Whisper
          </p>
        </div>
      </div>

      {audioFiles.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center">
            <FileAudio size={48} className="mx-auto text-[hsl(var(--muted-foreground))] mb-4 opacity-40" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Спочатку завантажте аудіо на кроці "Завантаження"
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Controls */}
          <Card className="mb-4">
            <CardContent className="p-5">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Аудіо файл</label>
                  <select
                    value={selectedFile || ''}
                    onChange={(e) => setSelectedFile(e.target.value)}
                    className="h-10 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm"
                  >
                    {audioFiles.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.filename} ({f.duration_sec ? formatDuration(f.duration_sec) : '?'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Модель</label>
                  <select
                    value={modelSize}
                    onChange={(e) => setModelSize(e.target.value)}
                    className="h-10 rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-3 text-sm"
                  >
                    <option value="tiny">tiny (75MB, швидка)</option>
                    <option value="base">base (145MB)</option>
                    <option value="small">small (488MB, рекомендовано)</option>
                    <option value="medium">medium (1.5GB)</option>
                  </select>
                </div>
                <div className="flex-1" />
                <Button
                  onClick={handleTranscribe}
                  disabled={transcribing || !selectedFile}
                >
                  {transcribing ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Транскрипція...
                    </>
                  ) : (
                    <>
                      <FileAudio size={14} />
                      Транскрибувати
                    </>
                  )}
                </Button>
              </div>
              {transcribing && transcribeProgress > 0 && (
                <Progress value={transcribeProgress} className="mt-3" />
              )}
            </CardContent>
          </Card>

          {/* Stats & Actions */}
          {segments.length > 0 && (
            <div className="flex items-center gap-4 mb-4 text-sm">
              <span className="text-[hsl(var(--muted-foreground))]">
                Сегментів: <span className="text-[hsl(var(--foreground))] font-semibold">{includedSegments.length}</span>
                {' / '}
                {segments.length}
              </span>
              <span className="text-[hsl(var(--muted-foreground))]">
                Тривалість: <span className="text-[hsl(var(--foreground))] font-semibold">{formatDuration(totalDuration)}</span>
              </span>
              {selectedIds.size >= 2 && (
                <Button variant="secondary" size="sm" onClick={handleMerge}>
                  <Merge size={14} />
                  Об'єднати ({selectedIds.size})
                </Button>
              )}
            </div>
          )}

          {/* Segments Table */}
          {segments.length > 0 && (
            <Card className="overflow-hidden">
              <div className="grid grid-cols-[40px_70px_70px_1fr_40px_40px_40px] gap-2 px-5 py-3 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] text-[11px] text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wider sticky top-0 z-10">
                <div></div>
                <div>Початок</div>
                <div>Кінець</div>
                <div>Текст</div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div className="divide-y divide-[hsl(var(--border))] max-h-[60vh] overflow-y-auto">
                {segments.map((seg) => (
                  <div
                    key={seg.id}
                    className={`grid grid-cols-[40px_70px_70px_1fr_40px_40px_40px] gap-2 px-5 py-3 items-center text-sm hover:bg-[hsl(var(--muted))] transition-colors ${
                      !seg.included ? 'opacity-40' : ''
                    } ${selectedIds.has(seg.id) ? 'bg-[hsl(var(--muted))]' : ''}`}
                  >
                    {/* Checkbox */}
                    <div>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(seg.id)}
                        onChange={() => toggleSelect(seg.id)}
                        className="rounded"
                      />
                    </div>
                    {/* Times */}
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] font-mono">
                      {formatDuration(seg.start_time)}
                    </div>
                    <div className="text-[11px] text-[hsl(var(--muted-foreground))] font-mono">
                      {formatDuration(seg.end_time)}
                    </div>
                    {/* Text */}
                    <div>
                      {editingId === seg.id ? (
                        <div className="flex gap-1">
                          <Input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="flex-1"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSave(seg.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-green-500" onClick={() => handleSave(seg.id)}>
                            <Check size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-[hsl(var(--destructive))]" onClick={() => setEditingId(null)}>
                            <X size={14} />
                          </Button>
                        </div>
                      ) : (
                        <span
                          className={`cursor-pointer hover:text-[hsl(var(--primary))] transition-colors ${
                            seg.text_edited ? 'text-yellow-500' : ''
                          }`}
                          onClick={() => {
                            setEditingId(seg.id)
                            setEditText(seg.text)
                          }}
                        >
                          {seg.text || <span className="text-[hsl(var(--muted-foreground))] italic">порожньо</span>}
                        </span>
                      )}
                    </div>
                    {/* Play */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => playSegment(seg)}
                    >
                      {playingId === seg.id ? <Pause size={14} /> : <Play size={14} />}
                    </Button>
                    {/* Toggle */}
                    <div className="flex items-center justify-center">
                      <Switch
                        checked={seg.included}
                        onCheckedChange={() => handleToggle(seg)}
                        className="scale-75"
                      />
                    </div>
                    {/* Delete */}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                      onClick={() => handleDelete(seg.id)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
