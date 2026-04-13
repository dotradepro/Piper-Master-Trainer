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
  ToggleLeft,
  ToggleRight,
} from 'lucide-react'

export function TranscriptionPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [segments, setSegments] = useState<Segment[]>([])
  const [loading, setLoading] = useState(true)
  const [transcribing, setTranscribing] = useState(false)
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
    try {
      const segs = await transcriptionApi.start(projectId, selectedFile, modelSize)
      setSegments(segs)
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Помилка транскрипції')
    } finally {
      setTranscribing(false)
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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-400 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <FileAudio size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Транскрипція</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Розпізнавання мовлення через Whisper
          </p>
        </div>
      </div>

      {audioFiles.length === 0 ? (
        <div className="rounded-2xl border border-[hsl(var(--border))] glass p-10 text-center">
          <FileAudio size={48} className="mx-auto text-[hsl(var(--muted-foreground)/.4)] mb-4" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Спочатку завантажте аудіо на кроці "Завантаження"
          </p>
        </div>
      ) : (
        <>
          {/* Controls */}
          <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5 mb-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div>
                <label className="block text-[11px] font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Аудіо файл</label>
                <select
                  value={selectedFile || ''}
                  onChange={(e) => setSelectedFile(e.target.value)}
                  className="px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm transition-smooth"
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
                  className="px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm transition-smooth"
                >
                  <option value="tiny">tiny (75MB, швидка)</option>
                  <option value="base">base (145MB)</option>
                  <option value="small">small (488MB, рекомендовано)</option>
                  <option value="medium">medium (1.5GB)</option>
                </select>
              </div>
              <div className="flex-1" />
              <button
                onClick={handleTranscribe}
                disabled={transcribing || !selectedFile}
                className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(160_71%_40%)] text-white text-sm font-semibold disabled:opacity-50 shadow-lg shadow-[hsl(var(--primary)/.25)] transition-smooth"
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
              </button>
            </div>
          </div>

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
                <button
                  onClick={handleMerge}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[hsl(var(--secondary))] text-sm hover:bg-[hsl(var(--primary)/.15)] transition-smooth"
                >
                  <Merge size={14} />
                  Об'єднати ({selectedIds.size})
                </button>
              )}
            </div>
          )}

          {/* Segments Table */}
          {segments.length > 0 && (
            <div className="rounded-2xl border border-[hsl(var(--border))] glass overflow-hidden">
              <div className="grid grid-cols-[40px_70px_70px_1fr_40px_40px_40px] gap-2 px-5 py-3 border-b border-[hsl(var(--border))] text-[11px] text-[hsl(var(--muted-foreground))] font-medium uppercase tracking-wider">
                <div></div>
                <div>Початок</div>
                <div>Кінець</div>
                <div>Текст</div>
                <div></div>
                <div></div>
                <div></div>
              </div>
              <div className="divide-y divide-[hsl(var(--border)/.5)] max-h-[60vh] overflow-y-auto">
                {segments.map((seg) => (
                  <div
                    key={seg.id}
                    className={`grid grid-cols-[40px_70px_70px_1fr_40px_40px_40px] gap-2 px-5 py-3 items-center text-sm hover:bg-[hsl(var(--secondary)/.3)] transition-smooth ${
                      !seg.included ? 'opacity-40' : ''
                    } ${selectedIds.has(seg.id) ? 'bg-[hsl(var(--primary)/.05)]' : ''}`}
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
                          <input
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="flex-1 px-3 py-1.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm transition-smooth"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSave(seg.id)
                              if (e.key === 'Escape') setEditingId(null)
                            }}
                          />
                          <button onClick={() => handleSave(seg.id)} className="text-green-400 p-1.5 rounded-xl hover:bg-green-400/10 transition-smooth">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-red-400 p-1.5 rounded-xl hover:bg-red-400/10 transition-smooth">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <span
                          className={`cursor-pointer hover:text-[hsl(var(--primary))] transition-smooth ${
                            seg.text_edited ? 'text-yellow-300' : ''
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
                    <button
                      onClick={() => playSegment(seg)}
                      className="p-1.5 rounded-xl text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/.1)] transition-smooth"
                    >
                      {playingId === seg.id ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                    {/* Toggle */}
                    <button
                      onClick={() => handleToggle(seg)}
                      className="p-1.5 rounded-xl text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary))] transition-smooth"
                    >
                      {seg.included ? <ToggleRight size={14} className="text-green-400" /> : <ToggleLeft size={14} />}
                    </button>
                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(seg.id)}
                      className="p-1.5 rounded-xl text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-400/10 transition-smooth"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
