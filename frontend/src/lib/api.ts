import { supabase } from './supabase'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/, '')

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown }

export class ApiError extends Error {
  status: number
  details?: unknown

  constructor(status: number, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.details = details
  }
}

export const api = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new ApiError(401, 'Debes iniciar sesión.')

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })

  if (response.status === 204) return undefined as T
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new ApiError(response.status, payload.error || 'No fue posible completar la solicitud.', payload.details)
  }

  return payload as T
}

export const apiData = async <T>(path: string, options: RequestOptions = {}) => {
  const response = await api<{ data: T }>(path, options)
  return response.data
}
