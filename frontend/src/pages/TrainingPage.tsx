import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { trainingApi } from '@/api/training'
import { datasetsApi } from '@/api/datasets'
import type { TrainingStatus, CheckpointInfo } from '@/api/training'
import type { DatasetInfo } from '@/api/datasets'
import { GpuMonitor } from '@/components/training/GpuMonitor'
import { formatDuration, formatBytes } from '@/lib/utils'
import { Brain, Play, Square, Loader2, Download, BarChart3, RotateCcw } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, Button, Form, Table, Badge, Row, Col, Spinner } from 'react-bootstrap'
import { toast } from 'sonner'

export function TrainingPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [selectedDataset, setSelectedDataset] = useState<string>('')
  const [status, setStatus] = useState<TrainingStatus | null>(null)
  const [checkpoints, setCheckpoints] = useState<CheckpointInfo[]>([])
  const [metricsHistory, setMetricsHistory] = useState<{ epoch: number; loss_g?: number; loss_d?: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  // Config
  const [batchSize, setBatchSize] = useState(4)
  const [maxEpochs, setMaxEpochs] = useState(10000)
  const [precision, setPrecision] = useState('32')
  const [accumGrad, setAccumGrad] = useState(8)
  const [mode, setMode] = useState<'scratch' | 'finetune'>('scratch')

  useEffect(() => {
    if (projectId) loadData()
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [projectId])

  const loadData = async () => {
    if (!projectId) return
    try {
      const [ds, st, ckpts] = await Promise.all([
        datasetsApi.list(projectId),
        trainingApi.status(),
        trainingApi.checkpoints(projectId),
      ])
      setDatasets(ds)
      if (ds.length > 0) setSelectedDataset(ds[0].id)
      setStatus(st)
      setCheckpoints(ckpts)
      if (st.active) startPolling()
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const startPolling = () => {
    if (pollRef.current) return
    pollRef.current = window.setInterval(async () => {
      try {
        const st = await trainingApi.status()
        setStatus(st)
        if (st.metrics.epoch !== undefined) {
          setMetricsHistory((prev) => {
            const last = prev[prev.length - 1]
            if (last && last.epoch === st.metrics.epoch) return prev
            return [...prev.slice(-200), { epoch: st.metrics.epoch, loss_g: st.metrics.loss_g, loss_d: st.metrics.loss_d }]
          })
        }
        if (!st.active) {
          if (pollRef.current) clearInterval(pollRef.current)
          pollRef.current = null
          if (projectId) {
            const ckpts = await trainingApi.checkpoints(projectId)
            setCheckpoints(ckpts)
          }
        }
      } catch {
      }
    }, 3000)
  }

  const handleStart = async () => {
    if (!projectId || !selectedDataset) return
    setStarting(true)
    setError(null)
    setMetricsHistory([])
    try {
      await trainingApi.start({
        project_id: projectId,
        dataset_id: selectedDataset,
        mode,
        batch_size: batchSize,
        max_epochs: maxEpochs,
        precision,
        accumulate_grad_batches: accumGrad,
      })
      const st = await trainingApi.status()
      setStatus(st)
      startPolling()
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Помилка запуску'
      setError(msg)
      toast.error(msg)
    } finally {
      setStarting(false)
    }
  }

  const handleResume = async (checkpointPath: string) => {
    if (!projectId || !selectedDataset) {
      toast.error('Спочатку оберіть датасет')
      return
    }
    setStarting(true)
    setError(null)
    setMetricsHistory([])
    try {
      await trainingApi.resume(projectId, checkpointPath, selectedDataset, maxEpochs, batchSize, precision)
      const st = await trainingApi.status()
      setStatus(st)
      startPolling()
      toast.success('Тренування відновлено з checkpoint')
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Помилка відновлення'
      setError(msg)
      toast.error(msg)
    } finally {
      setStarting(false)
    }
  }

  const handleStop = async () => {
    try {
      await trainingApi.stop()
      const st = await trainingApi.status()
      setStatus(st)
    } catch {
    }
  }

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [status?.log_lines])

  if (loading) {
    return (
      <div className="text-center py-5 text-muted">
        <Spinner animation="border" variant="primary" className="mb-3" />
        <div>Завантаження...</div>
      </div>
    )
  }

  const isActive = status?.active ?? false

  return (
    <div>
      <div className="d-flex align-items-center gap-3 mb-4">
        <Brain size={20} />
        <div>
          <h1 className="h5 mb-0 fw-semibold">Тренування</h1>
          <p className="small text-muted mb-0">VITS модель на GPU</p>
        </div>
      </div>

      <Row>
        <Col lg={8}>
          <div className="d-flex flex-column gap-3">
            {/* Config */}
            <Card>
              <Card.Header>
                <Card.Title className="mb-0">Конфігурація</Card.Title>
              </Card.Header>
              <Card.Body>
                <Row className="g-3">
                  <Col xs={6} md={4}>
                    <Form.Group>
                      <Form.Label>Датасет</Form.Label>
                      <Form.Select value={selectedDataset} onChange={(e) => setSelectedDataset(e.target.value)} disabled={isActive}>
                        {datasets.map((d) => (
                          <option key={d.id} value={d.id}>{d.total_segments} seg, {formatDuration(d.total_duration)}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xs={6} md={4}>
                    <Form.Group>
                      <Form.Label>Режим</Form.Label>
                      <Form.Select value={mode} onChange={(e) => setMode(e.target.value as 'scratch' | 'finetune')} disabled={isActive}>
                        <option value="scratch">З нуля</option>
                        <option value="finetune">Fine-tune</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xs={6} md={4}>
                    <Form.Group>
                      <Form.Label>Batch size</Form.Label>
                      <Form.Control type="number" value={batchSize} onChange={(e) => setBatchSize(+e.target.value)} min={1} max={32} disabled={isActive} />
                    </Form.Group>
                  </Col>
                  <Col xs={6} md={4}>
                    <Form.Group>
                      <Form.Label>Макс. епох</Form.Label>
                      <Form.Control type="number" value={maxEpochs} onChange={(e) => setMaxEpochs(+e.target.value)} min={10} step={100} disabled={isActive} />
                    </Form.Group>
                  </Col>
                  <Col xs={6} md={4}>
                    <Form.Group>
                      <Form.Label>Precision</Form.Label>
                      <Form.Select value={precision} onChange={(e) => setPrecision(e.target.value)} disabled={isActive}>
                        <option value="32">FP32</option>
                        <option value="16-mixed">FP16 Mixed</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col xs={6} md={4}>
                    <Form.Group>
                      <Form.Label>Grad Accum</Form.Label>
                      <Form.Control type="number" value={accumGrad} onChange={(e) => setAccumGrad(+e.target.value)} min={1} max={32} disabled={isActive} />
                    </Form.Group>
                  </Col>
                </Row>
                <div className="d-flex gap-2 mt-3">
                  {!isActive ? (
                    <Button variant="primary" onClick={handleStart} disabled={starting || !selectedDataset || datasets.length === 0}>
                      {starting ? <><Spinner animation="border" size="sm" className="me-1" /> Запуск...</> : <><Play size={14} className="me-1" /> Почати тренування</>}
                    </Button>
                  ) : (
                    <Button variant="danger" onClick={handleStop}>
                      <Square size={14} className="me-1" /> Зупинити
                    </Button>
                  )}
                </div>
                {error && (
                  <div className="mt-3 border border-danger rounded p-3 small text-danger d-flex align-items-center gap-2 bg-danger bg-opacity-10">
                    <span className="rounded-circle bg-danger d-inline-block" style={{ width: 6, height: 6 }} />{error}
                  </div>
                )}
              </Card.Body>
            </Card>

            {/* Metrics Chart */}
            {metricsHistory.length > 1 && (
              <Card>
                <Card.Header>
                  <Card.Title className="mb-0 d-flex align-items-center gap-2">
                    <BarChart3 size={16} /> Loss
                  </Card.Title>
                </Card.Header>
                <Card.Body>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={metricsHistory}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="epoch" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Line type="monotone" dataKey="loss_g" stroke="#22c55e" strokeWidth={1.5} dot={false} name="Generator" />
                      <Line type="monotone" dataKey="loss_d" stroke="#f97316" strokeWidth={1.5} dot={false} name="Discriminator" />
                    </LineChart>
                  </ResponsiveContainer>
                </Card.Body>
              </Card>
            )}

            {/* Current Metrics */}
            {isActive && status?.metrics && Object.keys(status.metrics).length > 0 && (
              <Card>
                <Card.Body>
                  <Row className="g-3">
                    {status.metrics.epoch !== undefined && (
                      <Col xs={3}>
                        <div className="bg-light rounded p-3">
                          <div className="small text-muted text-uppercase" style={{ letterSpacing: '0.05em' }}>Epoch</div>
                          <div className="font-monospace fw-bold fs-5 mt-1">{status.metrics.epoch}</div>
                        </div>
                      </Col>
                    )}
                    {status.metrics.step !== undefined && (
                      <Col xs={3}>
                        <div className="bg-light rounded p-3">
                          <div className="small text-muted text-uppercase" style={{ letterSpacing: '0.05em' }}>Step</div>
                          <div className="font-monospace fw-bold fs-5 mt-1">{status.metrics.step}</div>
                        </div>
                      </Col>
                    )}
                    {status.metrics.loss_g !== undefined && (
                      <Col xs={3}>
                        <div className="bg-light rounded p-3">
                          <div className="small text-muted text-uppercase" style={{ letterSpacing: '0.05em' }}>Loss G</div>
                          <div className="font-monospace fw-bold fs-5 mt-1 text-success">{status.metrics.loss_g.toFixed(3)}</div>
                        </div>
                      </Col>
                    )}
                    {status.metrics.loss_d !== undefined && (
                      <Col xs={3}>
                        <div className="bg-light rounded p-3">
                          <div className="small text-muted text-uppercase" style={{ letterSpacing: '0.05em' }}>Loss D</div>
                          <div className="font-monospace fw-bold fs-5 mt-1 text-warning">{status.metrics.loss_d.toFixed(3)}</div>
                        </div>
                      </Col>
                    )}
                  </Row>
                  <div className="small text-muted mt-3 text-uppercase" style={{ letterSpacing: '0.05em' }}>
                    Час: {formatDuration(status.elapsed_seconds)}
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Log */}
            {status && status.log_lines.length > 0 && (
              <Card>
                <Card.Header>
                  <Card.Title className="mb-0">Лог</Card.Title>
                </Card.Header>
                <Card.Body>
                  <div ref={logRef} className="overflow-auto font-monospace small text-muted" style={{ maxHeight: 200 }}>
                    {status.log_lines.map((line, i) => (
                      <div key={i} className={line.includes('ERROR') ? 'text-danger' : line.includes('Epoch') ? 'text-success' : ''}>{line}</div>
                    ))}
                  </div>
                </Card.Body>
              </Card>
            )}

            {/* Checkpoints */}
            {checkpoints.length > 0 && (
              <Card>
                <Card.Header>
                  <Card.Title className="mb-0">Чекпоінти <span className="text-muted fw-normal">({checkpoints.length})</span></Card.Title>
                </Card.Header>
                <Card.Body>
                  <Table hover size="sm" responsive>
                    <thead>
                      <tr>
                        <th className="small fw-medium text-muted">Файл</th>
                        <th className="small fw-medium text-muted text-end">Розмір</th>
                        <th className="small fw-medium text-muted text-end">Дії</th>
                      </tr>
                    </thead>
                    <tbody>
                      {checkpoints.slice(0, 10).map((ckpt, i) => (
                        <tr key={i}>
                          <td className="font-monospace small">{ckpt.filename}</td>
                          <td className="text-end small text-muted">{ckpt.size_mb.toFixed(1)} MB</td>
                          <td className="text-end">
                            <Button variant="outline-secondary" size="sm" onClick={() => handleResume(ckpt.path)} disabled={isActive || starting}>
                              <RotateCcw size={12} className="me-1" /> Продовжити
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
        </Col>

        {/* Sidebar */}
        <Col lg={4}>
          <div className="d-flex flex-column gap-3">
            <GpuMonitor />
            {datasets.length === 0 && (
              <Card className="border-warning bg-warning bg-opacity-10">
                <Card.Body>
                  <div className="small text-warning d-flex align-items-center gap-2">
                    <span className="rounded-circle bg-warning d-inline-block" style={{ width: 6, height: 6 }} />
                    Спочатку підготуйте датасет на кроці "Датасет"
                  </div>
                </Card.Body>
              </Card>
            )}
            <Card>
              <Card.Header>
                <Card.Title className="mb-0">RTX 3050 рекомендації</Card.Title>
              </Card.Header>
              <Card.Body>
                <div className="d-flex flex-column gap-2 small text-muted">
                  <div className="d-flex justify-content-between p-2 bg-light rounded">
                    <span>Batch size</span><span className="font-monospace text-body">4</span>
                  </div>
                  <div className="d-flex justify-content-between p-2 bg-light rounded">
                    <span>Precision</span><span className="font-monospace text-body">FP32 (FP16 якщо OOM)</span>
                  </div>
                  <div className="d-flex justify-content-between p-2 bg-light rounded">
                    <span>Grad accumulation</span><span className="font-monospace text-body">8</span>
                  </div>
                  <div className="d-flex justify-content-between p-2 bg-light rounded">
                    <span>Ефективний batch</span><span className="font-monospace fw-semibold text-primary">{batchSize * accumGrad}</span>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </div>
        </Col>
      </Row>
    </div>
  )
}
