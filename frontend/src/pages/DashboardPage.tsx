import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProjectStore } from '@/stores/projectStore'
import { GpuMonitor } from '@/components/training/GpuMonitor'
import { PROJECT_STATUSES, LANGUAGES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { Plus, Trash2, ArrowRight, AudioWaveform } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { toast } from 'sonner'

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
      toast.success(`Проєкт "${project.name}" створено`)
      navigate(`/project/${project.id}/download`)
    } catch { } finally { setCreating(false) }
  }

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm(`Видалити проєкт "${name}"? Всі дані буде втрачено.`)) return
    await deleteProject(id).catch(() => {})
    toast.success(`Проєкт "${name}" видалено`)
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AudioWaveform size={20} />
          <div>
            <h1 className="text-lg font-semibold">Piper Trainer</h1>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Тренування голосових моделей TTS
            </p>
          </div>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Новий проєкт
        </Button>
      </div>

      {/* GPU Status */}
      <div className="mb-4">
        <GpuMonitor />
      </div>

      {/* Create Modal */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новий проєкт</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label>Назва</label>
              <Input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Мій голос"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <label>Мова</label>
              <select
                value={newLang}
                onChange={(e) => setNewLang(e.target.value)}
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.name}</option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Скасувати
            </Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? 'Створення...' : 'Створити'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Projects */}
      {loading && !projects.length ? (
        <div className="text-center py-16 text-[hsl(var(--muted-foreground))]">
          <div className="w-8 h-8 border-2 border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Завантаження...
        </div>
      ) : error ? (
        <div className="text-center py-16 text-[hsl(var(--destructive))]">{error}</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-20 h-20 rounded-lg bg-[hsl(var(--muted))] flex items-center justify-center mx-auto mb-5">
            <AudioWaveform size={32} className="text-[hsl(var(--muted-foreground))]" />
          </div>
          <p className="text-[hsl(var(--muted-foreground))] text-lg mb-2">Поки немає проєктів</p>
          <p className="text-[hsl(var(--muted-foreground))] text-sm mb-4">Створіть перший для початку тренування</p>
          <Button onClick={() => setShowCreate(true)}>
            <Plus size={16} />
            Створити проєкт
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((project) => {
            const statusInfo = PROJECT_STATUSES[project.status] || PROJECT_STATUSES.created
            return (
              <Link
                key={project.id}
                to={`/project/${project.id}/download`}
                className="no-underline"
              >
                <Card className="group hover:border-[hsl(var(--primary))] transition-colors h-full">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-md bg-[hsl(var(--muted))] flex items-center justify-center text-lg">
                          {project.language === 'uk' ? '🇺🇦' : '🌐'}
                        </div>
                        <div>
                          <h3 className="text-sm font-semibold group-hover:text-[hsl(var(--primary))] transition-colors">
                            {project.name}
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100"
                          onClick={(e) => handleDelete(e, project.id, project.name)}
                        >
                          <Trash2 size={14} />
                        </Button>
                        <ArrowRight size={16} className="text-[hsl(var(--muted-foreground))] group-hover:text-[hsl(var(--primary))] transition-colors" />
                      </div>
                    </div>
                    <p className="text-xs text-[hsl(var(--muted-foreground))] mt-3">{formatDate(project.created_at)}</p>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
