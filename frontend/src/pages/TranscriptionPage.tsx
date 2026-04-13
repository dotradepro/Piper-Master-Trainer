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
  Search,
} from 'lucide-react'
import { Card, Button, Form, Table, InputGroup, ProgressBar, Pagination, Spinner, Row, Col } from 'react-bootstrap'
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
      <div className="text-center py-5 text-muted">
        <Spinner className="mb-3" />
        <div>Завантаження...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-4">
        <FileAudio size={20} />
        <div>
          <h1 className="h5 mb-0 fw-semibold">Транскрипція</h1>
          <p className="text-muted small mb-0">
            Розпізнавання мовлення через Whisper
          </p>
        </div>
      </div>

      {audioFiles.length === 0 ? (
        <Card>
          <Card.Body className="text-center py-5">
            <FileAudio size={48} className="mb-3 opacity-25 text-muted" />
            <p className="text-muted small">
              Спочатку завантажте аудіо на кроці "Завантаження"
            </p>
          </Card.Body>
        </Card>
      ) : (
        <>
          {/* Controls */}
          <Card className="mb-3">
            <Card.Body>
              <Row className="g-3 align-items-end">
                <Col xs={6} md={4} lg={3}>
                  <Form.Group>
                    <Form.Label>Аудіо файл</Form.Label>
                    <Form.Select
                      value={selectedFile || ''}
                      onChange={(e) => setSelectedFile(e.target.value)}
                    >
                      {audioFiles.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.filename} ({f.duration_sec ? formatDuration(f.duration_sec) : '?'})
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={6} md={4} lg={3}>
                  <Form.Group>
                    <Form.Label>Модель</Form.Label>
                    <Form.Select
                      value={modelSize}
                      onChange={(e) => setModelSize(e.target.value)}
                    >
                      <option value="tiny">tiny (75MB, швидка)</option>
                      <option value="base">base (145MB)</option>
                      <option value="small">small (488MB, рекомендовано)</option>
                      <option value="medium">medium (1.5GB)</option>
                    </Form.Select>
                  </Form.Group>
                </Col>
                <Col xs={12} md={4} lg={6} className="text-end">
                  <Button
                    variant="primary"
                    onClick={handleTranscribe}
                    disabled={transcribing || !selectedFile}
                  >
                    {transcribing ? (
                      <>
                        <Loader2 size={14} className="me-1 spinner-rotate" />
                        Транскрипція...
                      </>
                    ) : (
                      <>
                        <FileAudio size={14} className="me-1" />
                        Транскрибувати
                      </>
                    )}
                  </Button>
                </Col>
              </Row>
              {transcribing && transcribeProgress > 0 && (
                <ProgressBar now={transcribeProgress} animated striped className="mt-3" style={{ height: 6 }} />
              )}
            </Card.Body>
          </Card>

          {/* Stats & Actions */}
          {segments.length > 0 && (
            <div className="d-flex align-items-center gap-3 mb-3 small flex-wrap">
              <span className="text-muted">
                Сегментів: <span className="text-body fw-semibold">{includedSegments.length}</span>
                {' / '}
                {segments.length}
              </span>
              <span className="text-muted">
                Тривалість: <span className="text-body fw-semibold">{formatDuration(totalDuration)}</span>
              </span>
              {selectedIds.size >= 2 && (
                <Button variant="secondary" size="sm" onClick={handleMerge}>
                  <Merge size={14} className="me-1" />
                  Об'єднати ({selectedIds.size})
                </Button>
              )}
            </div>
          )}

          {/* Filter bar */}
          {segments.length > 0 && (
            <div className="d-flex align-items-center gap-2 mb-3">
              <InputGroup style={{ maxWidth: 300 }}>
                <InputGroup.Text><Search size={14} /></InputGroup.Text>
                <Form.Control
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder="Пошук по тексту..."
                />
              </InputGroup>
              <Form.Select
                value={filterIncluded}
                onChange={(e) => setFilterIncluded(e.target.value as 'all' | 'included' | 'excluded')}
                style={{ width: 'auto' }}
              >
                <option value="all">Всі сегменти</option>
                <option value="included">Включені</option>
                <option value="excluded">Виключені</option>
              </Form.Select>
              {filteredSegments.length !== segments.length && (
                <span className="text-muted small">
                  Знайдено: {filteredSegments.length}
                </span>
              )}
            </div>
          )}

          {/* Segments Table */}
          {segments.length > 0 && (
            <Card>
              <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <Table hover size="sm" responsive className="mb-0">
                  <thead className="sticky-top bg-light">
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th style={{ width: 80 }}>Початок</th>
                      <th style={{ width: 80 }}>Кінець</th>
                      <th>Текст</th>
                      <th style={{ width: 120 }} className="text-center">Дії</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleSegments.map((seg) => (
                      <tr
                        key={seg.id}
                        className={`${!seg.included ? 'opacity-25' : ''} ${selectedIds.has(seg.id) ? 'table-active' : ''}`}
                      >
                        {/* Checkbox */}
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={selectedIds.has(seg.id)}
                            onChange={() => toggleSelect(seg.id)}
                          />
                        </td>
                        {/* Times */}
                        <td className="text-muted small font-monospace">
                          {formatDuration(seg.start_time)}
                        </td>
                        <td className="text-muted small font-monospace">
                          {formatDuration(seg.end_time)}
                        </td>
                        {/* Text */}
                        <td>
                          {editingId === seg.id ? (
                            <InputGroup size="sm">
                              <Form.Control
                                value={editText}
                                onChange={(e) => setEditText(e.target.value)}
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSave(seg.id)
                                  if (e.key === 'Escape') setEditingId(null)
                                }}
                              />
                              <Button variant="outline-success" onClick={() => handleSave(seg.id)}>
                                <Check size={14} />
                              </Button>
                              <Button variant="outline-danger" onClick={() => setEditingId(null)}>
                                <X size={14} />
                              </Button>
                            </InputGroup>
                          ) : (
                            <span
                              className={`cursor-pointer ${seg.text_edited ? 'text-warning' : ''}`}
                              style={{ cursor: 'pointer' }}
                              onClick={() => {
                                setEditingId(seg.id)
                                setEditText(seg.text)
                              }}
                            >
                              {seg.text || <span className="text-muted fst-italic">порожньо</span>}
                            </span>
                          )}
                        </td>
                        {/* Actions */}
                        <td>
                          <div className="d-flex align-items-center justify-content-center gap-1">
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 text-muted"
                              onClick={() => playSegment(seg)}
                            >
                              {playingId === seg.id ? <Pause size={14} /> : <Play size={14} />}
                            </Button>
                            <Form.Check
                              type="switch"
                              checked={seg.included}
                              onChange={() => handleToggle(seg)}
                              className="d-inline-block ms-1"
                            />
                            <Button
                              variant="link"
                              size="sm"
                              className="p-0 text-muted"
                              onClick={() => handleDelete(seg.id)}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <Card.Footer className="d-flex justify-content-center">
                  <Pagination size="sm" className="mb-0">
                    <Pagination.Prev
                      disabled={page === 0}
                      onClick={() => setPage((p) => p - 1)}
                    />
                    <Pagination.Item active>
                      {page + 1} / {totalPages}
                    </Pagination.Item>
                    <Pagination.Next
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage((p) => p + 1)}
                    />
                  </Pagination>
                </Card.Footer>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  )
}
