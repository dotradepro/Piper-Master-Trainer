import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProjectStore } from '@/stores/projectStore'
import { GpuMonitor } from '@/components/training/GpuMonitor'
import { PROJECT_STATUSES, LANGUAGES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { Plus, Trash2, FolderOpen, ArrowRight, X, AudioWaveform } from 'lucide-react'

export function DashboardPage() {
  const { projects, loading, error, fetchProjects, createProject, deleteProject } =
    useProjectStore()
  const navigate = useNavigate()
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLang, setNewLang] = useState('uk')
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      const project = await createProject({ name: newName.trim(), language: newLang })
      setNewName('')
      setShowCreate(false)
      navigate(`/project/${project.id}/download`)
    } catch { } finally { setCreating(false) }
  }

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Видалити проєкт "${name}"? Всі дані буде втрачено.`)) return
    await deleteProject(id).catch(() => {})
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient">Piper</span> Trainer
          </h1>
          <p className="text-sm text-[hsl(var(--muted-foreground))] mt-1">
            Тренування голосових моделей TTS
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(160_71%_40%)] text-white text-sm font-semibold shadow-lg shadow-[hsl(var(--primary)/.25)] transition-smooth"
        >
          <Plus size={16} />
          Новий проєкт
        </button>
      </div>

      {/* GPU Status */}
      <div className="mb-6">
        <GpuMonitor />
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={() => setShowCreate(false)}>
          <div className="glass rounded-2xl border border-[hsl(var(--border))] p-6 w-full max-w-md shadow-2xl glow-green" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold">Новий проєкт</h2>
              <button onClick={() => setShowCreate(false)} className="p-1.5 rounded-lg hover:bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))] transition-smooth">
                <X size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Назва</label>
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Мій голос"
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm transition-smooth"
                  autoFocus onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[hsl(var(--muted-foreground))] mb-1.5 uppercase tracking-wider">Мова</label>
                <select value={newLang} onChange={(e) => setNewLang(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-[hsl(var(--secondary))] border border-[hsl(var(--border))] text-sm transition-smooth">
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>{l.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--secondary))] transition-smooth">
                Скасувати
              </button>
              <button onClick={handleCreate} disabled={!newName.trim() || creating}
                className="btn-primary px-5 py-2 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(160_71%_40%)] text-white text-sm font-semibold disabled:opacity-50 transition-smooth">
                {creating ? 'Створення...' : 'Створити'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Projects */}
      {loading && !projects.length ? (
        <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
          <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Завантаження...
        </div>
      ) : error ? (
        <div className="text-center py-16 text-red-400">{error}</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-[hsl(var(--secondary))] flex items-center justify-center mx-auto mb-5">
            <AudioWaveform size={32} className="text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-[hsl(var(--muted-foreground))] text-lg mb-2">Поки немає проєктів</p>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mb-6">Створіть перший для початку тренування</p>
          <button onClick={() => setShowCreate(true)}
            className="btn-primary px-6 py-2.5 rounded-xl bg-gradient-to-r from-[hsl(var(--primary))] to-[hsl(160_71%_40%)] text-white text-sm font-semibold shadow-lg shadow-[hsl(var(--primary)/.25)] transition-smooth">
            <Plus size={16} className="inline mr-2" />
            Створити проєкт
          </button>
        </div>
      ) : (
        <div className="grid gap-3">
          {projects.map((project) => {
            const statusInfo = PROJECT_STATUSES[project.status] || PROJECT_STATUSES.created
            return (
              <Link
                key={project.id}
                to={`/project/${project.id}/download`}
                className="group flex items-center justify-between p-4 rounded-2xl border border-[hsl(var(--border))] glass hover:glow-border hover:glow-green transition-smooth no-underline"
              >
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[hsl(var(--secondary))] to-[hsl(var(--muted))] flex items-center justify-center text-lg">
                    {project.language === 'uk' ? '🇺🇦' : '🌐'}
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold group-hover:text-[hsl(var(--primary))] transition-smooth">
                      {project.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                      <span className={`flex items-center gap-1 ${statusInfo.color}`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {statusInfo.label}
                      </span>
                      <span>{formatDate(project.created_at)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={(e) => handleDelete(e, project.id, project.name)}
                    className="p-2 rounded-xl text-[hsl(var(--muted-foreground))] hover:text-red-400 hover:bg-red-400/10 transition-smooth opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ArrowRight size={16} className="text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))] transition-smooth" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
