import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { youtubeApi, getAudioUrl } from '@/api/youtube'
import type { AudioFile } from '@/api/youtube'
import { formatDuration, formatBytes } from '@/lib/utils'
import { Download, Upload, Trash2, Play, Pause, Loader2, Music } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
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
      <div className="flex items-center gap-3 mb-6">
        <Download size={20} />
        <div>
          <h1 className="text-lg font-semibold">Завантаження аудіо</h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">YouTube або локальний файл</p>
        </div>
      </div>

      {/* YouTube */}
      <Card className="mb-4">
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm">YouTube</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex gap-2">
            <Input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              onKeyDown={(e) => e.key === 'Enter' && !downloading && handleDownload()}
              disabled={downloading}
              className="flex-1"
            />
            <Button onClick={handleDownload} disabled={downloading || !url.trim()}>
              {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              {downloading ? 'Завантаження...' : 'Завантажити'}
            </Button>
          </div>
          {downloading && downloadProgress > 0 && (
            <Progress value={downloadProgress} className="mt-3" />
          )}
        </CardContent>
      </Card>

      {/* Upload */}
      <Card className="mb-4">
        <CardContent className="px-4 pb-4 pt-4">
          <input ref={fileInputRef} type="file" accept=".wav,.mp3,.flac,.ogg,.m4a" onChange={handleUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full border-2 border-dashed border-[hsl(var(--border))] rounded-md p-6 text-center hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--muted))] transition-colors cursor-pointer group"
          >
            {uploading
              ? <Loader2 size={24} className="mx-auto text-[hsl(var(--primary))] animate-spin mb-2" />
              : <Upload size={24} className="mx-auto text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))] mb-2 transition-colors" />}
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{uploading ? 'Завантаження...' : 'Перетягніть файл або натисніть'}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1 tracking-wider">WAV MP3 FLAC OGG M4A</p>
          </button>
        </CardContent>
      </Card>

      {error && (
        <div className="rounded-md border border-[hsl(var(--destructive))] bg-[hsl(var(--destructive))]/10 p-3 mb-4 text-sm text-[hsl(var(--destructive))] flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--destructive))]" />{error}
        </div>
      )}

      {/* Files */}
      <Card>
        <CardHeader className="px-4 py-3">
          <CardTitle className="text-sm">
            Аудіо файли {files.length > 0 && <span className="text-[hsl(var(--muted-foreground))] font-normal">({files.length})</span>}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center"><div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin mx-auto" /></div>
          ) : files.length === 0 ? (
            <div className="p-10 text-center">
              <Music size={32} className="mx-auto text-[hsl(var(--muted-foreground))] mb-3 opacity-40" />
              <p className="text-sm text-[hsl(var(--muted-foreground))]">Аудіо файлів поки немає</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--muted))]">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] w-12"></th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))]">Файл</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] w-24">Тривалість</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] w-24">Розмір</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-[hsl(var(--muted-foreground))] w-24">Джерело</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-[hsl(var(--muted-foreground))] w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {files.map((file) => (
                    <tr key={file.id} className="hover:bg-[hsl(var(--muted))] transition-colors group">
                      <td className="px-4 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => togglePlay(file)}
                        >
                          {playingId === file.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                        </Button>
                      </td>
                      <td className="px-4 py-2 font-medium truncate max-w-[300px]">{file.filename}</td>
                      <td className="px-4 py-2 text-xs text-[hsl(var(--muted-foreground))] font-mono">
                        {file.duration_sec != null ? formatDuration(file.duration_sec) : '-'}
                      </td>
                      <td className="px-4 py-2 text-xs text-[hsl(var(--muted-foreground))]">
                        {file.file_size_bytes != null ? formatBytes(file.file_size_bytes) : '-'}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {file.source_url
                          ? <span className="text-[hsl(var(--destructive))]">YouTube</span>
                          : <span className="text-[hsl(var(--muted-foreground))]">Upload</span>}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]"
                          onClick={() => handleDelete(file.id, file.filename)}
                        >
                          <Trash2 size={14} />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
