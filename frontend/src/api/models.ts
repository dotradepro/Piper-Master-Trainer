import { api } from './client'

export interface ExportedModel {
  id: string
  project_id: string
  checkpoint_id: string
  onnx_path: string
  config_path: string
  file_size_bytes: number | null
  created_at: string
}

export const modelsApi = {
  export: (projectId: string, checkpointPath: string) =>
    api
      .post<ExportedModel>('/models/export', {
        project_id: projectId,
        checkpoint_path: checkpointPath,
      })
      .then((r) => r.data),

  list: (projectId: string) =>
    api.get<ExportedModel[]>(`/models/${projectId}`).then((r) => r.data),

  synthesize: (
    modelId: string,
    text: string,
    opts?: { length_scale?: number; noise_scale?: number; noise_w?: number }
  ) =>
    api
      .post(
        '/models/synthesize',
        { model_id: modelId, text, ...opts },
        { responseType: 'blob' }
      )
      .then((r) => r.data as Blob),
}
