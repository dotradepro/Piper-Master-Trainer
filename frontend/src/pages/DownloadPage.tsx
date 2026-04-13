import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { youtubeApi, getAudioUrl } from '@/api/youtube'
import type { AudioFile } from '@/api/youtube'
import { formatDuration, formatBytes } from '@/lib/utils'
import { Download, Upload, Trash2, Play, Pause, Loader2, Music } from 'lucide-react'
import { Card, Button, Table, InputGroup, Form, ProgressBar, Spinner, Alert } from 'react-bootstrap'
import { toast } from 'sonner'

export function DownloadPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [url, setUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<AudioFile[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { if (projectId) loadFiles() }, [projectId])

  const loadFiles = async () => {
    if (!projectId) return
    try { setFiles(await youtubeApi.listFiles(projectId)) } catch {} finally { setLoading(false) }
  }

  const handleDownload = async () => {
    if (!projectId || !url.trim()) return
    setDownloading(true); setError(null); setDownloadProgress(10)
    try {
      setDownloadProgress(30)
      const file = await youtubeApi.download(projectId, url.trim())
      setDownloadProgress(100)
      setFiles((prev) => [file, ...prev]); setUrl('')
      toast.success(`Завантажено: ${file.filename}`)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Помилка завантаження')
      toast.error('Помилка завантаження')
    }
    finally { setDownloading(false); setDownloadProgress(0) }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !projectId) return
    setUploading(true); setError(null)
    try {
      const audioFile = await youtubeApi.upload(projectId, file)
      setFiles((prev) => [audioFile, ...prev])
      toast.success(`Завантажено: ${audioFile.filename}`)
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Помилка')
      toast.error('Помилка завантаження файлу')
    }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Видалити "${name}"?`)) return
    await youtubeApi.deleteFile(id).catch(() => {})
    setFiles((prev) => prev.filter((f) => f.id !== id))
    toast.success(`Видалено: ${name}`)
  }

  const togglePlay = (file: AudioFile) => {
    if (playingId === file.id) { audioRef.current?.pause(); setPlayingId(null); return }
    audioRef.current?.pause()
    const audio = new Audio(getAudioUrl(file.file_path))
    audio.onended = () => setPlayingId(null)
    audio.play(); audioRef.current = audio; setPlayingId(file.id)
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-2 mb-4">
        <Download size={20} />
        <div>
          <h1 className="h5 mb-0 fw-semibold">Завантаження аудіо</h1>
          <p className="text-muted small mb-0">YouTube або локальний файл</p>
        </div>
      </div>

      {/* YouTube */}
      <Card className="mb-3">
        <Card.Header className="py-2">
          <span className="small fw-semibold">YouTube</span>
        </Card.Header>
        <Card.Body>
          <InputGroup>
            <Form.Control
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              onKeyDown={(e) => e.key === 'Enter' && !downloading && handleDownload()}
              disabled={downloading}
            />
            <Button
              variant="primary"
              onClick={handleDownload}
              disabled={downloading || !url.trim()}
            >
              {downloading ? <Loader2 size={14} className="me-1 spinner-rotate" /> : <Download size={14} className="me-1" />}
              {downloading ? 'Завантаження...' : 'Завантажити'}
            </Button>
          </InputGroup>
          {downloading && downloadProgress > 0 && (
            <ProgressBar now={downloadProgress} animated striped className="mt-3" style={{ height: 6 }} />
          )}
        </Card.Body>
      </Card>

      {/* Upload */}
      <Card className="mb-3">
        <Card.Body>
          <input ref={fileInputRef} type="file" accept=".wav,.mp3,.flac,.ogg,.m4a" onChange={handleUpload} className="d-none" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-100 border border-2 border-dashed rounded p-4 text-center bg-transparent"
            style={{ cursor: 'pointer' }}
          >
            {uploading
              ? <Loader2 size={24} className="d-block mx-auto text-primary mb-2 spinner-rotate" />
              : <Upload size={24} className="d-block mx-auto text-muted mb-2" />}
            <p className="text-muted small mb-1">{uploading ? 'Завантаження...' : 'Перетягніть файл або натисніть'}</p>
            <p className="text-muted small mb-0 letter-spacing-1">WAV MP3 FLAC OGG M4A</p>
          </button>
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" className="mb-3">{error}</Alert>
      )}

      {/* Files */}
      <Card>
        <Card.Header className="py-2">
          <span className="small fw-semibold">
            Аудіо файли {files.length > 0 && <span className="text-muted fw-normal">({files.length})</span>}
          </span>
        </Card.Header>
        <Card.Body className="p-0">
          {loading ? (
            <div className="text-center py-5"><Spinner /></div>
          ) : files.length === 0 ? (
            <div className="text-center py-5 text-muted">
              <Music size={32} className="mb-3 opacity-25" />
              <p className="small">Аудіо файлів поки немає</p>
            </div>
          ) : (
            <Table hover size="sm" responsive className="mb-0">
              <thead>
                <tr>
                  <th style={{ width: 48 }}></th>
                  <th>Файл</th>
                  <th style={{ width: 96 }}>Тривалість</th>
                  <th style={{ width: 96 }}>Розмір</th>
                  <th style={{ width: 96 }}>Джерело</th>
                  <th style={{ width: 48 }}></th>
                </tr>
              </thead>
              <tbody>
                {files.map((file) => (
                  <tr key={file.id}>
                    <td>
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-muted"
                        onClick={() => togglePlay(file)}
                      >
                        {playingId === file.id ? <Pause size={14} /> : <Play size={14} />}
                      </Button>
                    </td>
                    <td className="fw-medium text-truncate" style={{ maxWidth: 300 }}>{file.filename}</td>
                    <td className="text-muted small font-monospace">
                      {file.duration_sec != null ? formatDuration(file.duration_sec) : '-'}
                    </td>
                    <td className="text-muted small">
                      {file.file_size_bytes != null ? formatBytes(file.file_size_bytes) : '-'}
                    </td>
                    <td className="small">
                      {file.source_url
                        ? <span className="text-danger">YouTube</span>
                        : <span className="text-muted">Upload</span>}
                    </td>
                    <td className="text-end">
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 text-muted"
                        onClick={() => handleDelete(file.id, file.filename)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card.Body>
      </Card>
    </div>
  )
}
