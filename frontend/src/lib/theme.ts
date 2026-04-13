export function getTheme(): 'light' | 'dark' {
  const stored = localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function setTheme(mode: 'light' | 'dark') {
  localStorage.setItem('theme', mode)
  document.documentElement.classList.toggle('dark', mode === 'dark')
}

export function toggleTheme() {
  setTheme(getTheme() === 'dark' ? 'light' : 'dark')
}

export function initTheme() {
  setTheme(getTheme())
}
