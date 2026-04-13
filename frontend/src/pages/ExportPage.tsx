import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { trainingApi } from '@/api/training'
import { modelsApi } from '@/api/models'
import type { CheckpointInfo } from '@/api/training'
import type { ExportedModel } from '@/api/models'
import { formatBytes, formatDate } from '@/lib/utils'
import { Package, Loader2, Download } from 'lucide-react'
import { Card, Button, Form, Table, Badge, ProgressBar, Spinner } from 'react-bootstrap'
import { toast } from 'sonner'

export function ExportPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [checkpoints, setCheckpoints] = useState<CheckpointInfo[]>([])
  const [models, setModels] = useState<ExportedModel[]>([])
  const [selectedCkpt, setSelectedCkpt] = useState('')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (projectId) loadData()
  }, [projectId])

  const loadData = async () => {
    if (!projectId) return
    try {
      const [ckpts, mdls] = await Promise.all([
        trainingApi.checkpoints(projectId),
        modelsApi.list(projectId),
      ])
      setCheckpoints(ckpts)
      setModels(mdls)
      if (ckpts.length > 0) setSelectedCkpt(ckpts[0].path)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    if (!projectId || !selectedCkpt) return
    setExporting(true)
    setError(null)
    try {
      const model = await modelsApi.export(projectId, selectedCkpt)
      setModels((prev) => [model, ...prev])
      toast.success('Модель успішно експортовано')
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Помилка експорту'
      setError(msg)
      toast.error(msg)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-5 text-muted">
        <Spinner animation="border" variant="primary" className="mb-3" />
        <div>Завантаження...</div>
      </div>
    )
  }

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-4">
        <Package size={20} />
        <div>
          <h1 className="h5 mb-0 fw-semibold">Експорт</h1>
          <p className="small text-muted mb-0">Конвертація в ONNX для Piper</p>
        </div>
      </div>

      {/* Export Controls */}
      <Card className="mb-3">
        <Card.Header>
          <Card.Title className="mb-0">Експорт чекпоінта</Card.Title>
        </Card.Header>
        <Card.Body>
          {checkpoints.length === 0 ? (
            <div className="bg-light rounded p-4 text-center">
              <Package size={32} className="text-muted mb-3" />
              <p className="small text-muted mb-0">Немає чекпоінтів. Спочатку натренуйте модель.</p>
            </div>
          ) : (
            <div className="d-flex align-items-end gap-3">
              <Form.Group className="flex-grow-1">
                <Form.Label>Checkpoint</Form.Label>
                <Form.Select value={selectedCkpt} onChange={(e) => setSelectedCkpt(e.target.value)}>
                  {checkpoints.map((c) => (
                    <option key={c.path} value={c.path}>
                      {c.filename} ({c.size_mb.toFixed(0)} MB)
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Button variant="primary" onClick={handleExport} disabled={exporting}>
                {exporting ? <><Spinner animation="border" size="sm" className="me-1" /> Експорт...</> : <><Download size={14} className="me-1" /> Експортувати</>}
              </Button>
            </div>
          )}
          {exporting && (
            <div className="mt-3">
              <ProgressBar animated now={100} style={{ height: 8 }} />
            </div>
          )}
          {error && (
            <div className="mt-3 border border-danger rounded p-3 small text-danger d-flex align-items-center gap-2 bg-danger bg-opacity-10">
              <span className="rounded-circle bg-danger d-inline-block" style={{ width: 6, height: 6 }} />{error}
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Exported Models */}
      {models.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title className="mb-0">Експортовані моделі <span className="text-muted fw-normal">({models.length})</span></Card.Title>
          </Card.Header>
          <Card.Body>
            <Table hover size="sm" responsive>
              <thead>
                <tr>
                  <th className="small fw-medium text-muted">Модель</th>
                  <th className="small fw-medium text-muted text-end">Розмір</th>
                  <th className="small fw-medium text-muted text-end">Дата</th>
                  <th className="small fw-medium text-muted text-end">Статус</th>
                  <th className="small fw-medium text-muted text-end">Дія</th>
                </tr>
              </thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id}>
                    <td className="small fw-medium">{m.onnx_path.split('/').pop()}</td>
                    <td className="text-end small text-muted">
                      {m.file_size_bytes ? formatBytes(m.file_size_bytes) : '-'}
                    </td>
                    <td className="text-end small text-muted">
                      {formatDate(m.created_at)}
                    </td>
                    <td className="text-end">
                      <Badge bg="success">ONNX</Badge>
                    </td>
                    <td className="text-end">
                      <Button variant="outline-primary" size="sm" href={`/api/audio/${m.onnx_path}`} download>
                        <Download size={12} className="me-1" />Скачати
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Card.Body>
        </Card>
      )}
    </div>
  )
}
