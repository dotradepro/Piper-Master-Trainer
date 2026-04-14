import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { trainingApi } from '@/api/training'
import { datasetsApi } from '@/api/datasets'
import type { TrainingStatus, CheckpointInfo, CatalogVoice, DownloadStatus } from '@/api/training'
import type { DatasetInfo } from '@/api/datasets'
import { GpuMonitor } from '@/components/training/GpuMonitor'
import { formatDuration, formatBytes } from '@/lib/utils'
import { Brain, Play, Square, Loader2, Download, BarChart3, RotateCcw, Upload, Trash2 } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Card, Button, Form, Table, Badge, Row, Col, Spinner, ProgressBar, Modal } from 'react-bootstrap'
import { toast } from 'sonner'

export function TrainingPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [datasets, setDatasets] = useState<DatasetInfo[]>([])
  const [selectedDataset, setSelectedDataset] = useState<string>('')
  const [status, setStatus] = useState<TrainingStatus | null>(null)
  const [checkpoints, setCheckpoints] = useState<CheckpointInfo[]>([])
  const [pretrained, setPretrained] = useState<CheckpointInfo[]>([])
  const [selectedPretrained, setSelectedPretrained] = useState<string>('')
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const [showCatalog, setShowCatalog] = useState(false)
  const [catalog, setCatalog] = useState<CatalogVoice[]>([])
  const [downloads, setDownloads] = useState<Record<string, DownloadStatus>>({})
  const catalogPollRef = useRef<number | null>(null)
  const [metricsHistory, setMetricsHistory] = useState<{ epoch: number; loss_g?: number; loss_d?: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<number | null>(null)
  const logRef = useRef<HTMLDivElement>(null)

  // Config — persisted per project in localStorage
  const storageKey = projectId ? `training_config_${projectId}` : ''
  const savedConfig = (() => {
    if (!storageKey) return null
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null') } catch { return null }
  })()

  const [batchSize, setBatchSize] = useState<number>(savedConfig?.batchSize ?? 4)
  const [maxEpochs, setMaxEpochs] = useState<number>(savedConfig?.maxEpochs ?? 10000)
  const [precision, setPrecision] = useState<string>(savedConfig?.precision ?? '32')
  const [precisionTouched, setPrecisionTouched] = useState(!!savedConfig?.precision)
  const [mode, setMode] = useState<'scratch' | 'finetune'>(savedConfig?.mode ?? 'scratch')

  // Persist config on change
  useEffect(() => {
    if (!storageKey) return
    localStorage.setItem(storageKey, JSON.stringify({
      batchSize, maxEpochs, precision, mode,
      pretrained: selectedPretrained,
    }))
  }, [storageKey, batchSize, maxEpochs, precision, mode, selectedPretrained])

  // Restore selectedPretrained after pretrained list loads
  useEffect(() => {
    if (savedConfig?.pretrained && pretrained.some((p) => p.path === savedConfig.pretrained)) {
      setSelectedPretrained(savedConfig.pretrained)
    }
  }, [pretrained])

  // Auto-switch to fp16-mixed when mode becomes finetune (economy ~40% VRAM),
  // unless user already changed precision manually.
  useEffect(() => {
    if (mode === 'finetune' && !precisionTouched && precision === '32') {
      setPrecision('16-mixed')
    }
  }, [mode])

  useEffect(() => {
    if (projectId) loadData()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (catalogPollRef.current) clearInterval(catalogPollRef.current)
    }
  }, [projectId])

  const loadData = async () => {
    if (!projectId) return
    try {
      const [ds, st, ckpts, pre] = await Promise.all([
        datasetsApi.list(projectId),
        trainingApi.status(),
        trainingApi.checkpoints(projectId),
        trainingApi.pretrained(),
      ])
      setDatasets(ds)
      if (ds.length > 0) setSelectedDataset(ds[0].id)
      setStatus(st)
      setCheckpoints(ckpts)
      setPretrained(pre)
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
      if (mode === 'finetune' && !selectedPretrained) {
        throw new Error('Для fine-tune оберіть базову модель')
      }
      await trainingApi.start({
        project_id: projectId,
        dataset_id: selectedDataset,
        mode,
        base_checkpoint: mode === 'finetune' ? selectedPretrained : undefined,
        batch_size: batchSize,
        max_epochs: maxEpochs,
        precision,
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

  const refreshPretrained = async () => {
    const pre = await trainingApi.pretrained()
    setPretrained(pre)
  }

  const openCatalog = async () => {
    setShowCatalog(true)
    try {
      const data = await trainingApi.pretrainedCatalog()
      setCatalog(data.voices)
      setDownloads(data.downloads || {})
      startCatalogPolling()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Не вдалося завантажити каталог')
    }
  }

  const closeCatalog = () => {
    setShowCatalog(false)
    if (catalogPollRef.current) {
      clearInterval(catalogPollRef.current)
      catalogPollRef.current = null
    }
  }

  const startCatalogPolling = () => {
    if (catalogPollRef.current) return
    catalogPollRef.current = window.setInterval(async () => {
      try {
        const data = await trainingApi.pretrainedCatalog()
        setCatalog(data.voices)
        setDownloads(data.downloads || {})
        // If all done, stop polling and refresh local list
        const anyActive = Object.values(data.downloads || {}).some(
          (d) => d.status === 'downloading' || d.status === 'resolving' || d.status === 'starting'
        )
        if (!anyActive) {
          if (catalogPollRef.current) {
            clearInterval(catalogPollRef.current)
            catalogPollRef.current = null
          }
          await refreshPretrained()
        }
      } catch {
      }
    }, 1500)
  }

  const handleCatalogDownload = async (voice: CatalogVoice) => {
    try {
      const state = await trainingApi.downloadPretrained(voice.id)
      setDownloads((prev) => ({ ...prev, [voice.id]: state }))
      startCatalogPolling()
      toast.success(`Завантаження ${voice.label} розпочато`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Помилка завантаження')
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.ckpt')) {
      toast.error('Оберіть .ckpt файл')
      return
    }
    setUploadProgress(0)
    try {
      const uploaded = await trainingApi.uploadPretrained(file, setUploadProgress)
      await refreshPretrained()
      setSelectedPretrained(uploaded.path)
      toast.success(`Модель ${uploaded.filename} завантажена`)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Помилка завантаження')
    } finally {
      setUploadProgress(null)
      if (uploadRef.current) uploadRef.current.value = ''
    }
  }

  const handleDeletePretrained = async (filename: string, path: string) => {
    if (!confirm(`Видалити ${filename}?`)) return
    try {
      await trainingApi.deletePretrained(filename)
      if (selectedPretrained === path) setSelectedPretrained('')
      await refreshPretrained()
      toast.success('Модель видалена')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Помилка видалення')
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
                  {mode === 'finetune' && (
                    <Col xs={12}>
                      <Form.Group>
                        <div className="d-flex align-items-center justify-content-between mb-1">
                          <Form.Label className="mb-0">Базова модель</Form.Label>
                          <div className="d-flex gap-2 align-items-center">
                            <input
                              ref={uploadRef}
                              type="file"
                              accept=".ckpt"
                              onChange={handleUpload}
                              style={{ display: 'none' }}
                            />
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={openCatalog}
                              disabled={isActive}
                            >
                              <Download size={12} className="me-1" /> Каталог онлайн
                            </Button>
                            <Button
                              size="sm"
                              variant="outline-primary"
                              onClick={() => uploadRef.current?.click()}
                              disabled={isActive || uploadProgress !== null}
                            >
                              {uploadProgress !== null ? (
                                <><Spinner animation="border" size="sm" className="me-1" /> {uploadProgress}%</>
                              ) : (
                                <><Upload size={12} className="me-1" /> Свій .ckpt</>
                              )}
                            </Button>
                            <Button size="sm" variant="outline-secondary" onClick={refreshPretrained} disabled={isActive}>
                              <RotateCcw size={12} />
                            </Button>
                          </div>
                        </div>
                        <Form.Select value={selectedPretrained} onChange={(e) => setSelectedPretrained(e.target.value)} disabled={isActive}>
                          <option value="">— оберіть pretrained —</option>
                          {pretrained.map((p) => (
                            <option key={p.path} value={p.path}>{p.filename} ({p.size_mb.toFixed(0)} MB)</option>
                          ))}
                        </Form.Select>
                        {pretrained.length > 0 && (
                          <div className="mt-2 d-flex flex-wrap gap-1">
                            {pretrained.map((p) => (
                              <Badge key={p.path} bg="light" text="dark" className="d-flex align-items-center gap-1 border">
                                <span className="font-monospace small">{p.filename}</span>
                                <button
                                  type="button"
                                  className="btn btn-link btn-sm p-0 text-danger"
                                  style={{ lineHeight: 1 }}
                                  onClick={() => handleDeletePretrained(p.filename, p.path)}
                                  disabled={isActive}
                                  title="Видалити"
                                >
                                  <Trash2 size={12} />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                        {pretrained.length === 0 && uploadProgress === null && (
                          <Form.Text className="text-warning">
                            Немає pretrained моделей. Завантажте .ckpt (напр. uk_UA-lada-x_low.ckpt — жіночий, uk_UA-ukrainian_tts-medium.ckpt — чоловічий). Джерело: github.com/rhasspy/piper → VOICES.md
                          </Form.Text>
                        )}
                      </Form.Group>
                    </Col>
                  )}
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
                      <Form.Select value={precision} onChange={(e) => { setPrecision(e.target.value); setPrecisionTouched(true) }} disabled={isActive}>
                        <option value="32">FP32</option>
                        <option value="16-mixed">FP16 Mixed</option>
                      </Form.Select>
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

            {/* Live Training Progress */}
            {isActive && status?.metrics && Object.keys(status.metrics).length > 0 && (
              <Card>
                <Card.Header className="d-flex align-items-center justify-content-between">
                  <Card.Title className="mb-0">Прогрес тренування</Card.Title>
                  {status.metrics.progress !== undefined && (
                    <Badge bg="primary">{status.metrics.progress?.toFixed(1)}%</Badge>
                  )}
                </Card.Header>
                <Card.Body>
                  {/* Progress bar */}
                  {status.metrics.progress !== undefined && (
                    <ProgressBar
                      now={status.metrics.progress}
                      animated
                      striped
                      className="mb-3"
                      style={{ height: 8 }}
                      label={status.metrics.progress > 10 ? `${status.metrics.progress.toFixed(0)}%` : ''}
                    />
                  )}

                  {/* Main metrics row */}
                  <Row className="g-3 mb-3">
                    {status.metrics.epoch !== undefined && (
                      <Col xs={6} md={3}>
                        <div className="bg-light rounded p-2 text-center">
                          <div className="font-monospace fw-bold">{status.metrics.epoch}{status.metrics.max_epochs ? ` / ${status.metrics.max_epochs}` : ''}</div>
                          <div className="small text-muted">Epoch</div>
                        </div>
                      </Col>
                    )}
                    {status.metrics.step !== undefined && (
                      <Col xs={6} md={3}>
                        <div className="bg-light rounded p-2 text-center">
                          <div className="font-monospace fw-bold">{status.metrics.step}</div>
                          <div className="small text-muted">Step</div>
                        </div>
                      </Col>
                    )}
                    {status.metrics.eta_seconds !== undefined && status.metrics.eta_seconds > 0 && (
                      <Col xs={6} md={3}>
                        <div className="bg-light rounded p-2 text-center">
                          <div className="font-monospace fw-bold">{formatDuration(status.metrics.eta_seconds)}</div>
                          <div className="small text-muted">ETA</div>
                        </div>
                      </Col>
                    )}
                    {status.metrics.elapsed_seconds !== undefined && (
                      <Col xs={6} md={3}>
                        <div className="bg-light rounded p-2 text-center">
                          <div className="font-monospace fw-bold">{formatDuration(status.metrics.elapsed_seconds)}</div>
                          <div className="small text-muted">Час</div>
                        </div>
                      </Col>
                    )}
                  </Row>

                  {/* Loss metrics */}
                  <Row className="g-3">
                    {status.metrics.loss_g !== undefined && (
                      <Col xs={6} md={3}>
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

        <Modal show={showCatalog} onHide={closeCatalog} size="lg" scrollable>
          <Modal.Header closeButton>
            <Modal.Title className="h6">Каталог Piper голосів (HF rhasspy/piper-checkpoints)</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {catalog.length === 0 ? (
              <div className="text-center text-muted py-4">
                <Spinner animation="border" size="sm" /> Завантаження каталогу...
              </div>
            ) : (
              <Table hover size="sm" responsive className="mb-0">
                <thead>
                  <tr>
                    <th className="small fw-medium text-muted">Голос</th>
                    <th className="small fw-medium text-muted">Мова</th>
                    <th className="small fw-medium text-muted">Стать</th>
                    <th className="small fw-medium text-muted">Якість</th>
                    <th className="small fw-medium text-muted text-end">Дії</th>
                  </tr>
                </thead>
                <tbody>
                  {catalog.map((v) => {
                    const dl = downloads[v.id]
                    const isActive = dl && (dl.status === 'downloading' || dl.status === 'resolving' || dl.status === 'starting')
                    return (
                      <tr key={v.id}>
                        <td>
                          <div className="fw-medium">{v.label}</div>
                          <div className="font-monospace small text-muted">{v.id}</div>
                        </td>
                        <td className="small">{v.locale}</td>
                        <td className="small">
                          <Badge bg={v.gender === 'male' ? 'info' : 'warning'} text={v.gender === 'male' ? 'light' : 'dark'}>
                            {v.gender === 'male' ? 'чол' : 'жін'}
                          </Badge>
                        </td>
                        <td className="small font-monospace">{v.quality}</td>
                        <td className="text-end" style={{ minWidth: 180 }}>
                          {v.installed && !isActive ? (
                            <Badge bg="success">✓ Встановлено</Badge>
                          ) : isActive ? (
                            <div style={{ minWidth: 140 }}>
                              <ProgressBar
                                now={dl.progress}
                                label={dl.status === 'downloading' ? `${dl.progress.toFixed(0)}%` : dl.status}
                                animated
                                style={{ height: 16 }}
                              />
                              {dl.total > 0 && (
                                <div className="small text-muted mt-1">
                                  {(dl.downloaded / 1024 / 1024).toFixed(0)} / {(dl.total / 1024 / 1024).toFixed(0)} MB
                                </div>
                              )}
                            </div>
                          ) : dl && dl.status === 'error' ? (
                            <div>
                              <Badge bg="danger" className="mb-1">Помилка</Badge>
                              <Button size="sm" variant="outline-primary" onClick={() => handleCatalogDownload(v)}>
                                <Download size={12} className="me-1" /> Повторити
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="primary" onClick={() => handleCatalogDownload(v)}>
                              <Download size={12} className="me-1" /> Завантажити
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </Table>
            )}
            <div className="small text-muted mt-3">
              Джерело: <span className="font-monospace">huggingface.co/datasets/rhasspy/piper-checkpoints</span>. Файли зберігаються в <span className="font-monospace">backend/storage/pretrained/</span>.
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" size="sm" onClick={closeCatalog}>Закрити</Button>
          </Modal.Footer>
        </Modal>

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
                    <span>Batch size</span><span className="font-monospace fw-semibold text-primary">{batchSize}</span>
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
