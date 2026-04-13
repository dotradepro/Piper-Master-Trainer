import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { modelsApi } from '@/api/models'
import type { ExportedModel } from '@/api/models'
import { formatBytes } from '@/lib/utils'
import { PlayCircle, Loader2, Volume2 } from 'lucide-react'
import { Card, Button, Form, Row, Col, Spinner } from 'react-bootstrap'
import { toast } from 'sonner'

export function TestPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const [models, setModels] = useState<ExportedModel[]>([])
  const [selectedModel, setSelectedModel] = useState('')
  const [text, setText] = useState('Привіт, це тестове повідомлення для перевірки якості голосової моделі.')
  const [lengthScale, setLengthScale] = useState(1.0)
  const [noiseScale, setNoiseScale] = useState(0.667)
  const [noiseW, setNoiseW] = useState(0.8)
  const [synthesizing, setSynthesizing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [history, setHistory] = useState<{ text: string; url: string }[]>([])
  const [loading, setLoading] = useState(true)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (projectId) loadData()
    return () => { history.forEach((h) => URL.revokeObjectURL(h.url)) }
  }, [projectId])

  const loadData = async () => {
    if (!projectId) return
    try {
      const mdls = await modelsApi.list(projectId)
      setModels(mdls)
      if (mdls.length > 0) setSelectedModel(mdls[0].id)
    } catch {
    } finally {
      setLoading(false)
    }
  }

  const handleSynthesize = async () => {
    if (!selectedModel || !text.trim()) return
    setSynthesizing(true)
    setError(null)
    try {
      const blob = await modelsApi.synthesize(selectedModel, text.trim(), {
        length_scale: lengthScale,
        noise_scale: noiseScale,
        noise_w: noiseW,
      })
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
      setHistory((prev) => [{ text: text.trim(), url }, ...prev.slice(0, 9)])

      // Auto-play
      const audio = new Audio(url)
      audio.play()
      audioRef.current = audio
      toast.success('Синтез завершено')
    } catch (e: any) {
      const msg = e.response?.data?.detail || 'Помилка синтезу'
      setError(msg)
      toast.error(msg)
    } finally {
      setSynthesizing(false)
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
        <PlayCircle size={20} />
        <div>
          <h1 className="h5 mb-0 fw-semibold">Тестування</h1>
          <p className="small text-muted mb-0">Синтез мовлення та перевірка якості</p>
        </div>
      </div>

      {models.length === 0 ? (
        <Card>
          <Card.Body className="text-center py-4">
            <PlayCircle size={48} className="text-muted mb-3" />
            <p className="small text-muted mb-0">Немає експортованих моделей. Спочатку експортуйте чекпоінт.</p>
          </Card.Body>
        </Card>
      ) : (
        <Row>
          <Col lg={8}>
            <div className="d-flex flex-column gap-3">
              {/* Synthesis */}
              <Card>
                <Card.Header>
                  <Card.Title className="mb-0 d-flex align-items-center gap-2">
                    <Volume2 size={16} /> Синтез
                  </Card.Title>
                </Card.Header>
                <Card.Body>
                  <Form.Group className="mb-3">
                    <Form.Label>Модель</Form.Label>
                    <Form.Select value={selectedModel} onChange={(e) => setSelectedModel(e.target.value)}>
                      {models.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.onnx_path.split('/').pop()} ({m.file_size_bytes ? formatBytes(m.file_size_bytes) : '?'})
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                  <Form.Group className="mb-3">
                    <Form.Label>Текст</Form.Label>
                    <Form.Control as="textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)}
                      placeholder="Введіть текст українською..." />
                  </Form.Group>
                  <Button variant="primary" onClick={handleSynthesize} disabled={synthesizing || !text.trim()} className="w-100">
                    {synthesizing ? <><Spinner animation="border" size="sm" className="me-1" /> Синтез...</> : <><Volume2 size={14} className="me-1" /> Синтезувати</>}
                  </Button>
                  {error && (
                    <div className="mt-3 border border-danger rounded p-3 small text-danger d-flex align-items-center gap-2 bg-danger bg-opacity-10">
                      <span className="rounded-circle bg-danger d-inline-block" style={{ width: 6, height: 6 }} />{error}
                    </div>
                  )}

                  {/* Player */}
                  {audioUrl && (
                    <Card.Body className="mt-3 bg-light rounded p-3">
                      <audio controls src={audioUrl} className="w-100" style={{ height: 32 }} />
                    </Card.Body>
                  )}
                </Card.Body>
              </Card>

              {/* History */}
              {history.length > 0 && (
                <Card>
                  <Card.Header>
                    <Card.Title className="mb-0">Історія</Card.Title>
                  </Card.Header>
                  <Card.Body>
                    {history.map((h, i) => (
                      <div key={i} className={`pb-3 ${i < history.length - 1 ? 'border-bottom mb-3' : ''}`}>
                        <p className="small text-muted mb-2">{h.text.slice(0, 100)}</p>
                        <audio controls src={h.url} className="w-100" style={{ height: 32 }} />
                      </div>
                    ))}
                  </Card.Body>
                </Card>
              )}
            </div>
          </Col>

          {/* Settings */}
          <Col lg={4}>
            <Card>
              <Card.Header>
                <Card.Title className="mb-0">Параметри синтезу</Card.Title>
              </Card.Header>
              <Card.Body>
                <Form.Group className="mb-3">
                  <Form.Label className="d-flex justify-content-between small text-muted mb-2">
                    <span>Швидкість</span><span className="font-monospace text-body">{lengthScale.toFixed(1)}</span>
                  </Form.Label>
                  <Form.Range min={0.5} max={2.0} step={0.1} value={lengthScale}
                    onChange={(e) => setLengthScale(+e.target.value)} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="d-flex justify-content-between small text-muted mb-2">
                    <span>Noise Scale</span><span className="font-monospace text-body">{noiseScale.toFixed(2)}</span>
                  </Form.Label>
                  <Form.Range min={0} max={1} step={0.05} value={noiseScale}
                    onChange={(e) => setNoiseScale(+e.target.value)} />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label className="d-flex justify-content-between small text-muted mb-2">
                    <span>Noise W</span><span className="font-monospace text-body">{noiseW.toFixed(2)}</span>
                  </Form.Label>
                  <Form.Range min={0} max={1} step={0.05} value={noiseW}
                    onChange={(e) => setNoiseW(+e.target.value)} />
                </Form.Group>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}
    </div>
  )
}
