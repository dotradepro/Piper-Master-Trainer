import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useProjectStore } from '@/stores/projectStore'
import { GpuMonitor } from '@/components/training/GpuMonitor'
import { PROJECT_STATUSES, LANGUAGES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { Plus, Trash2, ArrowRight, AudioWaveform } from 'lucide-react'
import { Card, Button, Form, Badge, Modal, Row, Col, Spinner } from 'react-bootstrap'
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
      <div className="d-flex align-items-center justify-content-between mb-4">
        <div className="d-flex align-items-center gap-2">
          <AudioWaveform size={20} />
          <div>
            <h1 className="h5 mb-0 fw-semibold">Piper Trainer</h1>
            <p className="text-muted small mb-0">
              Тренування голосових моделей TTS
            </p>
          </div>
        </div>
        <Button variant="primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} className="me-1" />
          Новий проєкт
        </Button>
      </div>

      {/* GPU Status */}
      <div className="mb-3">
        <GpuMonitor />
      </div>

      {/* Create Modal */}
      <Modal show={showCreate} onHide={() => setShowCreate(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Новий проєкт</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Назва</Form.Label>
            <Form.Control
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Мій голос"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </Form.Group>
          <Form.Group className="mb-3">
            <Form.Label>Мова</Form.Label>
            <Form.Select
              value={newLang}
              onChange={(e) => setNewLang(e.target.value)}
            >
              {LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>{l.name}</option>
              ))}
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={() => setShowCreate(false)}>
            Скасувати
          </Button>
          <Button variant="primary" onClick={handleCreate} disabled={!newName.trim() || creating}>
            {creating ? 'Створення...' : 'Створити'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Projects */}
      {loading && !projects.length ? (
        <div className="text-center py-5 text-muted">
          <Spinner className="mb-3" />
          <div>Завантаження...</div>
        </div>
      ) : error ? (
        <div className="text-center py-5 text-danger">{error}</div>
      ) : projects.length === 0 ? (
        <div className="text-center py-5">
          <AudioWaveform size={40} className="mb-3 opacity-25 text-muted" />
          <p className="text-muted fs-5 mb-2">Поки немає проєктів</p>
          <p className="text-muted small mb-3">Створіть перший для початку тренування</p>
          <Button variant="primary" onClick={() => setShowCreate(true)}>
            <Plus size={16} className="me-1" />
            Створити проєкт
          </Button>
        </div>
      ) : (
        <Row xs={1} md={2} lg={3} className="g-3">
          {projects.map((project) => {
            const statusInfo = PROJECT_STATUSES[project.status] || PROJECT_STATUSES.created
            return (
              <Col key={project.id}>
                <Link
                  to={`/project/${project.id}/download`}
                  className="text-decoration-none"
                >
                  <Card className="h-100">
                    <Card.Body className="p-3">
                      <div className="d-flex align-items-start justify-content-between">
                        <div className="d-flex align-items-center gap-2">
                          <div
                            className="rounded d-flex align-items-center justify-content-center bg-light fs-5"
                            style={{ width: 40, height: 40 }}
                          >
                            {project.language === 'uk' ? '\u{1F1FA}\u{1F1E6}' : '\u{1F310}'}
                          </div>
                          <div>
                            <h6 className="mb-1 fw-semibold">{project.name}</h6>
                            <Badge bg={statusInfo.variant}>{statusInfo.label}</Badge>
                          </div>
                        </div>
                        <div className="d-flex align-items-center gap-1">
                          <Button
                            variant="link"
                            size="sm"
                            className="text-muted p-1"
                            onClick={(e) => handleDelete(e, project.id, project.name)}
                          >
                            <Trash2 size={14} />
                          </Button>
                          <ArrowRight size={16} className="text-muted" />
                        </div>
                      </div>
                      <p className="text-muted small mb-0 mt-2">{formatDate(project.created_at)}</p>
                    </Card.Body>
                  </Card>
                </Link>
              </Col>
            )
          })}
        </Row>
      )}
    </div>
  )
}
