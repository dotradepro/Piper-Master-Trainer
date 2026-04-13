import axios from 'axios'
import { API_BASE } from '@/lib/constants'

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.detail || error.message || 'Невідома помилка'
    console.error('API Error:', message)
    return Promise.reject(error)
  }
)
