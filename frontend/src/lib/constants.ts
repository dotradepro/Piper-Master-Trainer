export const API_BASE = '/api'

export const PROJECT_STATUSES: Record<string, { label: string; color: string }> = {
  created: { label: 'Створено', color: 'text-gray-400' },
  downloading: { label: 'Завантаження', color: 'text-blue-400' },
  transcribing: { label: 'Транскрипція', color: 'text-yellow-400' },
  dataset_ready: { label: 'Датасет готовий', color: 'text-cyan-400' },
  training: { label: 'Тренування', color: 'text-orange-400' },
  trained: { label: 'Натреновано', color: 'text-green-400' },
  exported: { label: 'Експортовано', color: 'text-emerald-400' },
  error: { label: 'Помилка', color: 'text-red-400' },
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
