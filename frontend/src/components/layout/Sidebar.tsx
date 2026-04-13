import { Link, useLocation, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { PIPELINE_STEPS } from '@/lib/constants'
import {
  LayoutDashboard,
  Download,
  FileAudio,
  Database,
  Brain,
  Package,
  PlayCircle,
  AudioWaveform,
} from 'lucide-react'

const stepIcons: Record<string, React.ReactNode> = {
  download: <Download size={16} />,
  transcription: <FileAudio size={16} />,
  dataset: <Database size={16} />,
  training: <Brain size={16} />,
  export: <Package size={16} />,
  test: <PlayCircle size={16} />,
}

export function Sidebar() {
  const location = useLocation()
  const { projectId } = useParams()

  return (
    <aside
      className="fixed left-0 top-0 h-full flex flex-col glass border-r border-[hsl(var(--border)/.5)]"
      style={{ width: 'var(--sidebar-width)', zIndex: 50 }}
    >
      {/* Logo */}
      <div className="p-5">
        <Link to="/" className="flex items-center gap-3 no-underline group">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(160_71%_40%)] flex items-center justify-center shadow-lg shadow-[hsl(var(--primary)/.2)] group-hover:shadow-[hsl(var(--primary)/.4)] transition-smooth">
            <AudioWaveform size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-[hsl(var(--foreground))]">Piper Trainer</h1>
            <p className="text-[10px] text-[hsl(var(--muted-foreground))] tracking-wider uppercase">Master v0.1</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 overflow-y-auto">
        <div className="mb-1 px-2 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">
          Навігація
        </div>
        <Link
          to="/"
          className={cn(
            'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium no-underline transition-smooth mb-1',
            location.pathname === '/'
              ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))] shadow-sm'
              : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary)/.7)]'
          )}
        >
          <LayoutDashboard size={16} />
          Дашборд
        </Link>

        {projectId && (
          <>
            <div className="mt-5 mb-2 px-2 text-[10px] font-semibold text-[hsl(var(--muted-foreground))] uppercase tracking-widest">
              Пайплайн
            </div>
            {PIPELINE_STEPS.map((step, i) => {
              const path = `/project/${projectId}/${step.path}`
              const isActive = location.pathname === path
              return (
                <Link
                  key={step.key}
                  to={path}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium no-underline transition-smooth mb-0.5',
                    isActive
                      ? 'bg-[hsl(var(--primary)/.12)] text-[hsl(var(--primary))] shadow-sm'
                      : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--secondary)/.7)]'
                  )}
                >
                  <span className={cn(
                    'flex items-center justify-center w-6 h-6 rounded-lg text-[10px] font-bold transition-smooth',
                    isActive
                      ? 'bg-[hsl(var(--primary))] text-white shadow-md shadow-[hsl(var(--primary)/.3)]'
                      : 'bg-[hsl(var(--secondary))] text-[hsl(var(--muted-foreground))]'
                  )}>
                    {i + 1}
                  </span>
                  {stepIcons[step.key]}
                  {step.label}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="p-4 mx-3 mb-3 space-y-2">
        <div className="flex items-center gap-2 text-[11px] text-[hsl(var(--muted-foreground))] px-1">
          <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--primary))] animate-pulse-glow" />
          GPU Ready
        </div>
        <div className="flex items-center gap-3 px-1">
          <a href="https://github.com/dotradepro" target="_blank" rel="noopener" className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-smooth no-underline">GitHub</a>
          <a href="https://ko-fi.com/dotradepro" target="_blank" rel="noopener" className="text-[10px] text-[hsl(var(--muted-foreground))] hover:text-pink-400 transition-smooth no-underline">Ko-fi</a>
        </div>
      </div>
    </aside>
  )
}
