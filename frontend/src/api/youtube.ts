import { api } from './client'

export interface AudioFile {
  id: string
  project_id: string
  filename: string
  source_url: string | null
  duration_sec: number | null
  file_path: string
  file_size_bytes: number | null
  created_at: string
}

export interface VideoInfo {
  title: string
  duration: number
  uploader: string
  thumbnail: string
  description: string
}

export const youtubeApi = {
  getInfo: (url: string) =>
    api.post<VideoInfo>('/youtube/info', null, { params: { url } }).then((r) => r.data),

  download: (projectId: string, url: string, audioFormat = 'wav') =>
    api
      .post<AudioFile>('/youtube/download', {
        project_id: projectId,
        url,
        audio_format: audioFormat,
      })
      .then((r) => r.data),

  upload: (projectId: string, file: File) => {
    const form = new FormData()
    form.append('project_id', projectId)
    form.append('file', file)
    return api
      .post<AudioFile>('/youtube/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data)
  },

  listFiles: (projectId: string) =>
    api.get<AudioFile[]>(`/youtube/files/${projectId}`).then((r) => r.data),

  deleteFile: (audioFileId: string) =>
    api.delete(`/youtube/files/${audioFileId}`).then((r) => r.data),
}

export function getAudioUrl(filePath: string): string {
  return `/api/audio/${filePath}`
}
