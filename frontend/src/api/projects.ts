import { api } from './client'

export interface Project {
  id: string
  name: string
  language: string
  espeak_voice: string
  sample_rate: number
  status: string
  description: string | null
  created_at: string
  updated_at: string
}

export interface ProjectListItem {
  id: string
  name: string
  language: string
  status: string
  created_at: string
}

export interface CreateProjectData {
  name: string
  language?: string
  espeak_voice?: string
  sample_rate?: number
  description?: string
}

export const projectsApi = {
  list: () => api.get<ProjectListItem[]>('/projects').then((r) => r.data),

  get: (id: string) => api.get<Project>(`/projects/${id}`).then((r) => r.data),

  create: (data: CreateProjectData) => api.post<Project>('/projects', data).then((r) => r.data),

  update: (id: string, data: Partial<CreateProjectData>) =>
    api.patch<Project>(`/projects/${id}`, data).then((r) => r.data),

  delete: (id: string) => api.delete(`/projects/${id}`).then((r) => r.data),
}
