import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { datasetsApi } from '@/api/datasets'
import type { DatasetInfo, DatasetStats, ValidationIssue, CsvRow } from '@/api/datasets'
import { formatDuration } from '@/lib/utils'
import { Database, Loader2, BarChart3 } from 'lucide-react'
import { Card, Button, Form, Table, Badge, Row, Col, ProgressBar, Spinner, Alert } from 'react-bootstrap'
import { toast } from 'sonner'

export function DatasetPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [stats, setStats] = useState<DatasetStats | null>(null)
  const [issues, setIssues] = useState<ValidationIssue[]>([])
  const [preview, setPreview] = useState<CsvRow[]>([])
  const [previewTotal, setPreviewTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [preparing, setPreparing] = useState(false)
  const [prepareProgress, setPrepareProgress] = useState(0)
  const [minDur, setMinDur] = useState(1.0)
  const [maxDur, setMaxDur] = useState(15.0)
  const [sampleRate, setSampleRate] = useState(22050)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (projectId) loadData()
  }, [projectId])

  const loadData = async () => {
    if (!projectId) return
    try {
      const ds = await datasetsApi.list(projectId)
      setDatasets(ds)
      if (ds.length > 0) {
        await loadDatasetDetails(ds[0].id)
      }
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const loadDatasetDetails = async (id: string) => {
    const [s, v, p] = await Promise.all([
      datasetsApi.stats(id).catch(() => null),
      datasetsApi.validate(id).catch(() => []),
      datasetsApi.preview(id, 50).catch(() => ({ total: 0, rows: [] })),
    ])
    if (s) setStats(s)
    setIssues(v)
    setPreview(p.rows)
    setPreviewTotal(p.total)
  }

  const handlePrepare = async () => {
    if (!projectId) return
    setPreparing(true)
    setError(null)
    setPrepareProgress(15)
    try {
      setPrepareProgress(40)
      const ds = await datasetsApi.prepare(projectId, minDur, maxDur, sampleRate)
      setPrepareProgress(100)
      setDatasets((prev) => [ds, ...prev])
      await loadDatasetDetails(ds.id)
      toast.success('Датасет підготовлено успішно')
    } catch (e: any) {
      setError(e.response?.data?.detail || 'Помилка підготовки датасету')
      toast.error('Помилка підготовки датасету')
    } finally {
      setPreparing(false)
      setPrepareProgress(0)
    }
  }

  const severityBg = (level: string): string => {
    switch (level) {
      case 'success': return 'success'
      case 'warning': return 'warning'
      case 'error': return 'danger'
      default: return 'info'
    }
  }

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
        <Database size={20} />
        <div>
          <h1 className="h5 mb-0 fw-semibold">Датасет</h1>
          <p className="text-muted small mb-0">Підготовка навчального датасету для Piper</p>
        </div>
      </div>

      {/* Prepare Controls */}
      <Card className="mb-3">
        <Card.Header className="py-2">
          <span className="small fw-semibold">Параметри підготовки</span>
        </Card.Header>
        <Card.Body>
          <Row className="g-3 align-items-end">
            <Col xs={6} md={3}>
              <Form.Group>
                <Form.Label>Мін. тривалість (с)</Form.Label>
                <Form.Control
                  type="number"
                  value={minDur}
                  onChange={(e) => setMinDur(+e.target.value)}
                  step={0.5}
                  min={0.5}
                  max={10}
                />
              </Form.Group>
            </Col>
            <Col xs={6} md={3}>
              <Form.Group>
                <Form.Label>Макс. тривалість (с)</Form.Label>
                <Form.Control
                  type="number"
                  value={maxDur}
                  onChange={(e) => setMaxDur(+e.target.value)}
                  step={1}
                  min={2}
                  max={30}
                />
              </Form.Group>
            </Col>
            <Col xs={6} md={3}>
              <Form.Group>
                <Form.Label>Sample Rate</Form.Label>
                <Form.Select
                  value={sampleRate}
                  onChange={(e) => setSampleRate(+e.target.value)}
                >
                  <option value={22050}>22050 Hz</option>
                  <option value={16000}>16000 Hz</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col xs={6} md={3} className="text-end">
              <Button variant="primary" onClick={handlePrepare} disabled={preparing}>
                {preparing ? (
                  <>
                    <Loader2 size={14} className="me-1 spinner-rotate" />
                    Підготовка...
                  </>
                ) : (
                  <>
                    <Database size={14} className="me-1" />
                    Підготувати датасет
                  </>
                )}
              </Button>
            </Col>
          </Row>
          {preparing && prepareProgress > 0 && (
            <ProgressBar now={prepareProgress} animated striped className="mt-3" style={{ height: 6 }} />
          )}
        </Card.Body>
      </Card>

      {error && (
        <Alert variant="danger" className="mb-3">{error}</Alert>
      )}

      {/* Stats + Validation */}
      {stats && (
        <Row className="g-3 mb-3">
          <Col md={6}>
            <Card className="h-100">
              <Card.Header className="py-2">
                <span className="small fw-semibold d-flex align-items-center gap-2">
                  <BarChart3 size={14} />
                  Статистика
                </span>
              </Card.Header>
              <Card.Body>
                <Row xs={2} md={4} className="g-2">
                  <Col>
                    <div className="bg-light rounded p-2 text-center">
                      <div className="fs-5 fw-bold">{stats.total_segments}</div>
                      <div className="text-muted small">Сегментів</div>
                    </div>
                  </Col>
                  <Col>
                    <div className="bg-light rounded p-2 text-center">
                      <div className="fs-5 fw-bold">{formatDuration(stats.total_duration_sec)}</div>
                      <div className="text-muted small">Тривалість</div>
                    </div>
                  </Col>
                  <Col>
                    <div className="bg-light rounded p-2 text-center">
                      <div className="fs-5 fw-bold">{stats.avg_duration_sec.toFixed(1)}с</div>
                      <div className="text-muted small">Середня</div>
                    </div>
                  </Col>
                  <Col>
                    <div className="bg-light rounded p-2 text-center">
                      <div className="fs-5 fw-bold">{stats.min_duration_sec.toFixed(1)} / {stats.max_duration_sec.toFixed(1)}с</div>
                      <div className="text-muted small">Мін / Макс</div>
                    </div>
                  </Col>
                </Row>
                {/* Histogram */}
                {stats.duration_histogram.length > 0 && (
                  <div className="mt-3">
                    <div className="text-muted small mb-2">Розподіл тривалості</div>
                    <div className="d-flex align-items-end gap-1 bg-light rounded p-2" style={{ height: 70 }}>
                      {stats.duration_histogram.map((b, i) => {
                        const maxCount = Math.max(...stats.duration_histogram.map((x) => x.count))
                        const h = maxCount > 0 ? (b.count / maxCount) * 100 : 0
                        return (
                          <div key={i} className="flex-grow-1 d-flex flex-column align-items-center">
                            <div
                              className="w-100 bg-dark rounded-top"
                              style={{ height: `${h}%`, minHeight: b.count > 0 ? 2 : 0 }}
                              title={`${b.min}-${b.max}с: ${b.count}`}
                            />
                          </div>
                        )
                      })}
                    </div>
                    <div className="d-flex justify-content-between text-muted small mt-1">
                      <span>{stats.duration_histogram[0]?.min}с</span>
                      <span>{stats.duration_histogram[stats.duration_histogram.length - 1]?.max}с</span>
                    </div>
                  </div>
                )}
              </Card.Body>
            </Card>
          </Col>

          <Col md={6}>
            <Card className="h-100">
              <Card.Header className="py-2">
                <span className="small fw-semibold">Валідація</span>
              </Card.Header>
              <Card.Body>
                <div className="list-group list-group-flush">
                  {issues.map((issue, i) => (
                    <div key={i} className="list-group-item d-flex align-items-start gap-2 px-0">
                      <Badge bg={severityBg(issue.level)} className="mt-1">
                        {issue.level}
                      </Badge>
                      <span className="small">{issue.message}</span>
                    </div>
                  ))}
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      {/* CSV Preview */}
      {preview.length > 0 && (
        <Card>
          <Card.Header className="py-2">
            <span className="small fw-semibold">
              metadata.csv <span className="text-muted fw-normal">({previewTotal} записів)</span>
            </span>
          </Card.Header>
          <Card.Body className="p-0">
            <div style={{ maxHeight: '50vh', overflowY: 'auto' }}>
              <Table hover size="sm" className="mb-0">
                <thead className="sticky-top bg-light">
                  <tr>
                    <th style={{ width: 130 }}>Файл</th>
                    <th>Текст</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i}>
                      <td className="text-muted small font-monospace">{row.filename}</td>
                      <td>{row.text}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card.Body>
        </Card>
      )}
    </div>
  )
}
