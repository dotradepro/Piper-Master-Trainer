import { api } from './client'

export interface DatasetInfo {
  id: string
  project_id: string
  csv_path: string
  audio_dir: string
  total_segments: number
  total_duration: number
  config: string | null
  created_at: string
}

export interface DatasetStats {
  total_segments: number
  total_duration_sec: number
  avg_duration_sec: number
  min_duration_sec: number
  max_duration_sec: number
  avg_text_length: number
  duration_histogram: { min: number; max: number; count: number }[]
}

export interface ValidationIssue {
  level: 'success' | 'info' | 'warning' | 'error'
  message: string
}

export interface CsvRow {
  filename: string
  text: string
}

export const datasetsApi = {
  prepare: (projectId: string, minDuration = 1.0, maxDuration = 15.0, sampleRate = 22050) =>
    api
      .post<DatasetInfo>('/datasets/prepare', {
        project_id: projectId,
        min_duration: minDuration,
        max_duration: maxDuration,
        sample_rate: sampleRate,
      })
      .then((r) => r.data),

  list: (projectId: string) =>
    api.get<DatasetInfo[]>(`/datasets/${projectId}`).then((r) => r.data),

  stats: (datasetId: string) =>
    api.get<DatasetStats>(`/datasets/${datasetId}/stats`).then((r) => r.data),

  validate: (datasetId: string) =>
    api.get<ValidationIssue[]>(`/datasets/${datasetId}/validate`).then((r) => r.data),

  preview: (datasetId: string, limit = 50) =>
    api
      .get<{ total: number; rows: CsvRow[] }>(`/datasets/${datasetId}/preview`, {
        params: { limit },
      })
      .then((r) => r.data),
}
