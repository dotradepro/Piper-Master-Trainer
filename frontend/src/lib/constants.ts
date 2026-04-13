export const API_BASE = '/api'

export const PROJECT_STATUSES: Record<string, { label: string; variant: string }> = {
  created: { label: 'Створено', variant: 'secondary' },
  downloading: { label: 'Завантаження', variant: 'info' },
  transcribing: { label: 'Транскрипція', variant: 'warning' },
  dataset_ready: { label: 'Датасет', variant: 'info' },
  training: { label: 'Тренування', variant: 'warning' },
  trained: { label: 'Натреновано', variant: 'success' },
  exported: { label: 'Експортовано', variant: 'success' },
  error: { label: 'Помилка', variant: 'danger' },
}

export const PIPELINE_STEPS = [
  { key: 'download', label: 'Завантаження', path: 'download' },
  { key: 'transcription', label: 'Транскрипція', path: 'transcription' },
  { key: 'dataset', label: 'Датасет', path: 'dataset' },
  { key: 'training', label: 'Тренування', path: 'training' },
  { key: 'export', label: 'Експорт', path: 'export' },
  { key: 'test', label: 'Тестування', path: 'test' },
] as const

export const LANGUAGES = [
  { code: 'uk', name: 'Українська', espeak: 'uk' },
  { code: 'en', name: 'Англійська', espeak: 'en-us' },
  { code: 'de', name: 'Німецька', espeak: 'de' },
  { code: 'fr', name: 'Французька', espeak: 'fr-fr' },
  { code: 'es', name: 'Іспанська', espeak: 'es' },
  { code: 'pl', name: 'Польська', espeak: 'pl' },
] as const
