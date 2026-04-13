import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { youtubeApi, getAudioUrl } from '@/api/youtube'
import type { AudioFile } from '@/api/youtube'
import { formatDuration, formatBytes, formatDate } from '@/lib/utils'
import { Download, Upload, Trash2, Play, Pause, Loader2, Music } from 'lucide-react'

export function DownloadPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [url, setUrl] = useState('')
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<AudioFile[]>([])
  const [loading, setLoading] = useState(true)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => { if (projectId) loadFiles() }, [projectId])

  const loadFiles = async () => {
    if (!projectId) return
    try { setFiles(await youtubeApi.listFiles(projectId)) } catch {} finally { setLoading(false) }
  }

  const handleDownload = async () => {
    if (!projectId || !url.trim()) return
    setDownloading(true); setError(null)
    try {
      const file = await youtubeApi.download(projectId, url.trim())
      setFiles((prev) => [file, ...prev]); setUrl('')
    } catch (e: any) { setError(e.response?.data?.detail || 'Помилка завантаження') }
    finally { setDownloading(false) }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !projectId) return
    setUploading(true); setError(null)
    try {
      const audioFile = await youtubeApi.upload(projectId, file)
      setFiles((prev) => [audioFile, ...prev])
    } catch (e: any) { setError(e.response?.data?.detail || 'Помилка') }
    finally { setUploading(false); if (fileInputRef.current) fileInputRef.current.value = '' }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Видалити "${name}"?`)) return
    await youtubeApi.deleteFile(id).catch(() => {})
    setFiles((prev) => prev.filter((f) => f.id !== id))
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
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-400 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Download size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Завантаження аудіо</h1>
          <p className="text-xs text-[hsl(var(--muted-foreground))]">YouTube або локальний файл</p>
        </div>
      </div>

      {/* YouTube */}
      <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-5 h-5 rounded bg-red-500/20 flex items-center justify-center"><Play size={10} className="text-red-400" /></div>
          <span className="text-sm font-semibold">YouTube</span>
        </div>
        <div className="flex gap-2">
          <input type="text" value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="https://youtube.com/watch?v=..."
            className="flex-1 px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm transition-smooth"
            onKeyDown={(e) => e.key === 'Enter' && !downloading && handleDownload()} disabled={downloading} />
          <button onClick={handleDownload} disabled={downloading || !url.trim()}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(160_71%_40%)] text-white text-sm font-semibold disabled:opacity-50 transition-smooth">
            {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            {downloading ? 'Завантаження...' : 'Завантажити'}
          </button>
        </div>
      </div>

      {/* Upload */}
      <div className="rounded-2xl border border-[hsl(var(--border))] glass p-5 mb-4">
        <input ref={fileInputRef} type="file" accept=".wav,.mp3,.flac,.ogg,.m4a" onChange={handleUpload} className="hidden" />
        <button onClick={() => fileInputRef.current?.click()} disabled={uploading}
          className="w-full border-2 border-dashed border-[hsl(var(--border))] rounded-xl p-8 text-center hover:border-[hsl(var(--primary)/.4)] hover:bg-[hsl(var(--primary)/.03)] transition-smooth cursor-pointer group">
          {uploading
            ? <Loader2 size={28} className="mx-auto text-[hsl(var(--primary))] animate-spin mb-2" />
            : <Upload size={28} className="mx-auto text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))] mb-2 transition-smooth" />}
          <p className="text-sm text-[hsl(var(--muted-foreground))]">{uploading ? 'Завантаження...' : 'Перетягніть файл або натисніть'}</p>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))] mt-1 tracking-wider">WAV MP3 FLAC OGG M4A</p>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 mb-4 text-sm text-red-400 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400" />{error}
        </div>
      )}

      {/* Files */}
      <div className="rounded-2xl border border-[hsl(var(--border))] glass overflow-hidden">
        <div className="px-5 py-3 border-b border-[hsl(var(--border))]">
          <h2 className="text-sm font-semibold">Аудіо файли {files.length > 0 && <span className="text-[hsl(var(--muted-foreground))] font-normal">({files.length})</span>}</h2>
        </div>
        {loading ? (
          <div className="p-10 text-center"><div className="w-6 h-6 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin mx-auto" /></div>
        ) : files.length === 0 ? (
          <div className="p-10 text-center">
            <Music size={32} className="mx-auto text-[hsl(var(--muted-foreground)/.4)] mb-3" />
            <p className="text-sm text-[hsl(var(--muted-foreground))]">Аудіо файлів поки немає</p>
          </div>
        ) : (
          <div className="divide-y divide-[hsl(var(--border)/.5)]">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-[hsl(var(--secondary)/.3)] transition-smooth group">
                <button onClick={() => togglePlay(file)}
                  className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(var(--primary)/.15)] to-[hsl(var(--primary)/.05)] flex items-center justify-center text-[hsl(var(--primary))] hover:from-[hsl(var(--primary)/.25)] transition-smooth flex-shrink-0">
                  {playingId === file.id ? <Pause size={14} /> : <Play size={14} className="ml-0.5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.filename}</p>
                  <div className="flex items-center gap-3 mt-0.5 text-[11px] text-[hsl(var(--muted-foreground))]">
                    {file.duration_sec != null && <span>{formatDuration(file.duration_sec)}</span>}
                    {file.file_size_bytes != null && <span>{formatBytes(file.file_size_bytes)}</span>}
                    {file.source_url && <span className="text-red-400">YouTube</span>}
                  </div>
                </div>
                <button onClick={() => handleDelete(file.id, file.filename)}
                  className="p-2 rounded-xl text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-400/10 transition-smooth opacity-0 group-hover:opacity-100">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
