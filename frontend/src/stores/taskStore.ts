import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Task {
  id: string
  type: 'download' | 'transcription' | 'dataset' | 'training' | 'export' | 'synthesis'
  projectId: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress: number
  message: string
  startedAt: string
  completedAt?: string
  error?: string
  result?: Record<string, unknown>
}

interface TaskStore {
  tasks: Record<string, Task>
  addTask: (task: Task) => void
  updateTask: (id: string, updates: Partial<Task>) => void
  completeTask: (id: string, result?: Record<string, unknown>) => void
  failTask: (id: string, error: string) => void
  removeTask: (id: string) => void
  getActiveByProject: (projectId: string) => Task[]
  getByType: (projectId: string, type: Task['type']) => Task | undefined
}

export const useTaskStore = create<TaskStore>()(
  persist(
    (set, get) => ({
      tasks: {},

      addTask: (task) =>
        set((state) => ({ tasks: { ...state.tasks, [task.id]: task } })),

      updateTask: (id, updates) =>
        set((state) => {
          const existing = state.tasks[id]
          if (!existing) return state
          return { tasks: { ...state.tasks, [id]: { ...existing, ...updates } } }
        }),

      completeTask: (id, result) =>
        set((state) => {
          const existing = state.tasks[id]
          if (!existing) return state
          return {
            tasks: {
              ...state.tasks,
              [id]: {
                ...existing,
                status: 'completed',
                progress: 100,
                completedAt: new Date().toISOString(),
                result,
              },
            },
          }
        }),

      failTask: (id, error) =>
        set((state) => {
          const existing = state.tasks[id]
          if (!existing) return state
          return {
            tasks: {
              ...state.tasks,
              [id]: { ...existing, status: 'failed', error },
            },
          }
        }),

      removeTask: (id) =>
        set((state) => {
          const { [id]: _, ...rest } = state.tasks
          return { tasks: rest }
        }),

      getActiveByProject: (projectId) =>
        Object.values(get().tasks).filter(
          (t) => t.projectId === projectId && (t.status === 'running' || t.status === 'pending')
        ),

      getByType: (projectId, type) =>
        Object.values(get().tasks).find(
          (t) => t.projectId === projectId && t.type === type && t.status === 'running'
        ),
    }),
    {
      name: 'piper-tasks',
      partialize: (state) => ({
        tasks: Object.fromEntries(
          Object.entries(state.tasks).filter(
            ([_, t]) => t.status === 'running' || t.status === 'pending'
          )
        ),
      }),
    }
  )
)
