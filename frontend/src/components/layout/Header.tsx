import { Link, useLocation, useParams } from 'react-router-dom'
import { toggleTheme, getTheme } from '@/lib/theme'
import { PIPELINE_STEPS } from '@/lib/constants'
import { useGpuStatus } from '@/hooks/useGpuStatus'
import { useState } from 'react'
import Navbar from 'react-bootstrap/Navbar'
import Nav from 'react-bootstrap/Nav'
import Container from 'react-bootstrap/Container'
import Badge from 'react-bootstrap/Badge'
import Button from 'react-bootstrap/Button'
import { AudioWaveform, Sun, Moon, ExternalLink } from 'lucide-react'

export function Header() {
  const location = useLocation()
  const { projectId } = useParams()
  const gpu = useGpuStatus(10000)
  const [theme, setLocal] = useState(getTheme())

  const flip = () => { toggleTheme(); setLocal(getTheme()) }

  return (
    <Navbar expand="md" sticky="top" className="border-bottom py-1">
      <Container fluid className="px-3">
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center gap-2 fw-bold fs-6">
          <AudioWaveform size={18} /> Piper Trainer
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="nav" />
        <Navbar.Collapse id="nav">
          <Nav className="me-auto">
            <Nav.Link as={Link} to="/" active={location.pathname === '/'}>Панель</Nav.Link>
            {projectId && PIPELINE_STEPS.map((s, i) => {
              const p = `/project/${projectId}/${s.path}`
              return (
                <Nav.Link key={s.key} as={Link} to={p} active={location.pathname === p} className="d-flex align-items-center gap-1">
                  <Badge pill bg="secondary" style={{ fontSize: 9, width: 18, height: 18, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</Badge>
                  <span className="d-none d-lg-inline">{s.label}</span>
                </Nav.Link>
              )
            })}
          </Nav>
          <div className="d-flex align-items-center gap-2">
            {gpu?.available && (
              <Badge bg="light" text="dark" className="border d-none d-sm-inline-flex align-items-center gap-1 fw-normal">
                <span className="rounded-circle bg-success d-inline-block" style={{ width: 6, height: 6 }} />
                {gpu.vram_used_mb}/{gpu.vram_total_mb}MB
              </Badge>
            )}
            <Button variant="outline-secondary" size="sm" onClick={flip} className="d-flex align-items-center">
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </Button>
            <Button variant="outline-secondary" size="sm" href="https://github.com/dotradepro" target="_blank" className="d-flex align-items-center">
              <ExternalLink size={14} />
            </Button>
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  )
}
