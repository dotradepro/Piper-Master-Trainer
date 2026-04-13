import { api } from './client'

export interface TrainingStatus {
  active: boolean
  run_id: string | null
  pid: number | null
  metrics: Record<string, number>
  log_lines: string[]
  started_at: string | null
  elapsed_seconds: number
}

export interface CheckpointInfo {
  path: string
  filename: string
  size_mb: number
  modified?: string
}

export const trainingApi = {
  start: (data: {
    project_id: string
    dataset_id: string
    mode?: string
    base_checkpoint?: string
    batch_size?: number
    max_epochs?: number
    precision?: string
    accumulate_grad_batches?: number
    espeak_voice?: string
  }) => api.post<{ run_id: string }>('/training/start', data).then((r) => r.data),

  stop: (runId?: string) =>
    api.post('/training/stop', null, { params: runId ? { run_id: runId } : {} }).then((r) => r.data),

  status: () => api.get<TrainingStatus>('/training/status').then((r) => r.data),

  logs: (lastN = 100) =>
    api.get<{ lines: string[] }>('/training/logs', { params: { last_n: lastN } }).then((r) => r.data),

  checkpoints: (projectId: string) =>
    api.get<CheckpointInfo[]>(`/training/checkpoints/${projectId}`).then((r) => r.data),

  pretrained: () => api.get<CheckpointInfo[]>('/training/pretrained').then((r) => r.data),

  resume: (projectId: string, checkpointPath: string, datasetId: string, maxEpochs = 10000, batchSize = 1, precision = '32') =>
    api.post('/training/resume', null, {
      params: { project_id: projectId, checkpoint_path: checkpointPath, dataset_id: datasetId, max_epochs: maxEpochs, batch_size: batchSize, precision },
    }).then((r) => r.data),
}
