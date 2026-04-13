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
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'

const PAGE_SIZE = 50

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
  const [page, setPage] = useState(0)
  const [searchText, setSearchText] = useState('')
  const [filterIncluded, setFilterIncluded] = useState<'all' | 'included' | 'excluded'>('all')
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
      setPage(0)
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

  // Filtering
  const filteredSegments = segments.filter((s) => {
    if (filterIncluded === 'included' && !s.included) return false
    if (filterIncluded === 'excluded' && s.included) return false
    if (searchText && !s.text.toLowerCase().includes(searchText.toLowerCase())) return false
    return true
  })

  // Pagination
  const totalPages = Math.ceil(filteredSegments.length / PAGE_SIZE)
  const visibleSegments = filteredSegments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // Reset page when filters change
  useEffect(() => {
    setPage(0)
  }, [searchText, filterIncluded])

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
      <div className="flex items-center gap-3 mb-6">
        <FileAudio size={20} />
        <div>
          <h1 className="text-lg font-semibold">Транскрипція</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
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
            <CardContent className="px-4 pb-4 pt-4">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-end">
                <div>
                  <label>Аудіо файл</label>
                  <select
                    value={selectedFile || ''}
                    onChange={(e) => setSelectedFile(e.target.value)}
                  >
                    {audioFiles.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.filename} ({f.duration_sec ? formatDuration(f.duration_sec) : '?'})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Модель</label>
                  <select
                    value={modelSize}
                    onChange={(e) => setModelSize(e.target.value)}
                  >
                    <option value="tiny">tiny (75MB, швидка)</option>
                    <option value="base">base (145MB)</option>
                    <option value="small">small (488MB, рекомендовано)</option>
                    <option value="medium">medium (1.5GB)</option>
                  </select>
                </div>
                <div className="flex justify-end col-span-2 md:col-span-1 lg:col-span-2">
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
              </div>
              {transcribing && transcribeProgress > 0 && (
                <Progress value={transcribeProgress} className="mt-3" />
              )}
            </CardContent>
          </Card>

          {/* Stats & Actions */}
          {segments.length > 0 && (
            <div className="flex items-center gap-4 mb-4 text-sm flex-wrap">
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

          {/* Filter bar */}
          {segments.length > 0 && (
            <div className="flex items-center gap-3 mb-4">
              <div className="relative flex-1 max-w-xs">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))]" />
                <Input
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Пошук по тексту..."
                  className="pl-9"
                />
              </div>
              <select
                value={filterIncluded}
                onChange={(e) => setFilterIncluded(e.target.value as 'all' | 'included' | 'excluded')}
              >
                <option value="all">Всі сегменти</option>
                <option value="included">Включені</option>
                <option value="excluded">Виключені</option>
              </select>
              {filteredSegments.length !== segments.length && (
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  Знайдено: {filteredSegments.length}
                </span>
              )}
            </div>
          )}

          {/* Segments Table */}
          {segments.length > 0 && (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-[hsl(var(--muted))] sticky top-0 z-10">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]" style={{ width: 40 }}></th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]" style={{ width: 80 }}>Початок</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]" style={{ width: 80 }}>Кінець</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">Текст</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-[hsl(var(--muted-foreground))]" style={{ width: 120 }}>Дії</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[hsl(var(--border))]">
                    {visibleSegments.map((seg) => (
                      <tr
                        key={seg.id}
                        className={`hover:bg-[hsl(var(--muted))] transition-colors ${
                          !seg.included ? 'opacity-40' : ''
                        } ${selectedIds.has(seg.id) ? 'bg-[hsl(var(--muted))]' : ''}`}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(seg.id)}
                            onChange={() => toggleSelect(seg.id)}
                          />
                        </td>
                        {/* Times */}
                        <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] font-mono">
                          {formatDuration(seg.start_time)}
                        </td>
                        <td className="px-3 py-2 text-xs text-[hsl(var(--muted-foreground))] font-mono">
                          {formatDuration(seg.end_time)}
                        </td>
                        {/* Text */}
                        <td className="px-3 py-2">
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
                        </td>
                        {/* Actions */}
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => playSegment(seg)}
                            >
                              {playingId === seg.id ? <Pause size={14} /> : <Play size={14} />}
                            </Button>
                            <div className="flex items-center justify-center">
                              <Switch
                                checked={seg.included}
                                onCheckedChange={() => handleToggle(seg)}
                                className="scale-75"
                              />
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                              onClick={() => handleDelete(seg.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page === 0}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft size={14} />
                    Назад
                  </Button>
                  <span className="text-sm text-[hsl(var(--muted-foreground))]">
                    Сторінка {page + 1} з {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Далі
                    <ChevronRight size={14} />
                  </Button>
                </div>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
