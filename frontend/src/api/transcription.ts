import { api } from './client'

export interface Segment {
  id: string
  project_id: string
  audio_file_id: string
  start_time: number
  end_time: number
  text: string
  text_edited: boolean
  included: boolean
  created_at: string
}

export interface WhisperModel {
  id: string
  size_mb: number
  vram_mb: number
  speed: string
  quality: string
}

export const transcriptionApi = {
  start: (projectId: string, audioFileId: string, modelSize = 'small', language?: string) =>
    api
      .post<Segment[]>('/transcription/start', {
        project_id: projectId,
        audio_file_id: audioFileId,
        model_size: modelSize,
        language: language || null,
      })
      .then((r) => r.data),

  getSegments: (projectId: string) =>
    api.get<Segment[]>(`/transcription/segments/${projectId}`).then((r) => r.data),

  updateSegment: (segmentId: string, data: { text?: string; included?: boolean }) =>
    api.put<Segment>(`/transcription/segments/${segmentId}`, data).then((r) => r.data),

  deleteSegment: (segmentId: string) =>
    api.delete(`/transcription/segments/${segmentId}`).then((r) => r.data),

  mergeSegments: (segmentIds: string[]) =>
    api
      .post<Segment>('/transcription/segments/merge', { segment_ids: segmentIds })
      .then((r) => r.data),

  splitSegment: (segmentId: string, splitTime: number) =>
    api
      .post<Segment[]>(`/transcription/segments/${segmentId}/split`, { split_time: splitTime })
      .then((r) => r.data),

  getModels: () =>
    api
      .get<{ models: WhisperModel[]; recommended: string }>('/transcription/models')
      .then((r) => r.data),
}
