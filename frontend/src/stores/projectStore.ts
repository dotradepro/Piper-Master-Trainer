import { create } from 'zustand'
import type { Project, ProjectListItem } from '@/api/projects'
import { projectsApi } from '@/api/projects'

interface ProjectStore {
  projects: ProjectListItem[]
  currentProject: Project | null
  loading: boolean
  error: string | null

  fetchProjects: () => Promise<void>
  fetchProject: (id: string) => Promise<void>
  createProject: (data: { name: string; language?: string; description?: string }) => Promise<Project>
  deleteProject: (id: string) => Promise<void>
  clearCurrent: () => void
}

export const useProjectStore = create<ProjectStore>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null })
    try {
      const projects = await projectsApi.list()
      set({ projects, loading: false })
    } catch (e) {
      set({ error: 'Не вдалося завантажити проєкти', loading: false })
    }
  },

  fetchProject: async (id: string) => {
    set({ loading: true, error: null })
    try {
      const project = await projectsApi.get(id)
      set({ currentProject: project, loading: false })
    } catch (e) {
      set({ error: 'Проєкт не знайдено', loading: false })
    }
  },

  createProject: async (data) => {
    const project = await projectsApi.create(data)
    const { projects } = get()
    set({ projects: [{ ...project, created_at: project.created_at }, ...projects] })
    return project
  },

  deleteProject: async (id: string) => {
    await projectsApi.delete(id)
    const { projects } = get()
    set({ projects: projects.filter((p) => p.id !== id) })
  },

  clearCurrent: () => set({ currentProject: null }),
}))
