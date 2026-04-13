import { Link, useLocation, useParams } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { toggleTheme, getTheme } from '@/lib/theme'
import { PIPELINE_STEPS } from '@/lib/constants'
import { useGpuStatus } from '@/hooks/useGpuStatus'
import { useState } from 'react'
import {
  AudioWaveform,
  Sun,
  Moon,
  ExternalLink,
  Menu,
  X,
} from 'lucide-react'

export function Header() {
  const location = useLocation()
  const { projectId } = useParams()
  const gpu = useGpuStatus(10000)
  const [theme, setThemeState] = useState(getTheme())
  const [mobileOpen, setMobileOpen] = useState(false)

  const handleToggleTheme = () => {
    toggleTheme()
    setThemeState(getTheme())
  }

  const navItems = projectId
    ? PIPELINE_STEPS.map((step, i) => ({
        label: step.label,
        path: `/project/${projectId}/${step.path}`,
        number: i + 1,
      }))
    : []

  return (
    <header className="sticky top-0 z-50 w-full border-b border-[hsl(var(--border))] bg-[hsl(var(--background)/.95)] backdrop-blur-sm">
      <div className="max-w-[1600px] mx-auto flex h-14 items-center px-4 gap-1">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 mr-6 no-underline shrink-0">
          <AudioWaveform size={20} className="text-[hsl(var(--foreground))]" />
          <span className="font-bold text-sm text-[hsl(var(--foreground))]">Piper Trainer</span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-1 overflow-x-auto">
          <Link
            to="/"
            className={cn(
              'px-3 py-1.5 rounded-md text-sm no-underline whitespace-nowrap transition-colors',
              location.pathname === '/'
                ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] font-medium'
                : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
            )}
          >
            Панель
          </Link>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm no-underline whitespace-nowrap transition-colors',
                location.pathname === item.path
                  ? 'bg-[hsl(var(--secondary))] text-[hsl(var(--foreground))] font-medium'
                  : 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]'
              )}
            >
              <span className={cn(
                'w-5 h-5 rounded text-[10px] font-bold flex items-center justify-center',
                location.pathname === item.path
                  ? 'bg-[hsl(var(--foreground))] text-[hsl(var(--background))]'
                  : 'bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]'
              )}>
                {item.number}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex-1" />

        {/* Right side */}
        <div className="flex items-center gap-2">
          {/* GPU indicator */}
          {gpu?.available && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[hsl(var(--muted))] text-xs text-[hsl(var(--muted-foreground))]">
              <div className={cn(
                'w-1.5 h-1.5 rounded-full',
                (gpu.utilization_pct || 0) > 50 ? 'bg-green-500 animate-pulse' : 'bg-green-500'
              )} />
              {gpu.vram_used_mb}/{gpu.vram_total_mb}MB
            </div>
          )}

          {/* Theme toggle */}
          <button
            onClick={handleToggleTheme}
            className="p-2 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>

          {/* GitHub */}
          <a
            href="https://github.com/dotradepro"
            target="_blank"
            rel="noopener"
            className="p-2 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] hover:bg-[hsl(var(--accent))] transition-colors no-underline"
          >
            <ExternalLink size={16} />
          </a>

          {/* Mobile menu */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
          >
            {mobileOpen ? <X size={16} /> : <Menu size={16} />}
          </button>
        </div>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[hsl(var(--border))] p-2">
          <Link
            to="/"
            onClick={() => setMobileOpen(false)}
            className="block px-3 py-2 rounded-md text-sm text-[hsl(var(--foreground))] no-underline hover:bg-[hsl(var(--accent))]"
          >
            Панель
          </Link>
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm text-[hsl(var(--muted-foreground))] no-underline hover:bg-[hsl(var(--accent))]"
            >
              <span className="w-5 h-5 rounded bg-[hsl(var(--muted))] text-[10px] font-bold flex items-center justify-center">
                {item.number}
              </span>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  )
}
