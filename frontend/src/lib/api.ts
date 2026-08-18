import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import { clearSession, getToken } from './session'

/**
 * The one axios instance. Two interceptors do all the boring work:
 *
 *  1. request  — attaches the JWT.
 *  2. response — unwraps the `{ success, data, timestamp }` envelope and
 *                normalizes errors into a plain `Error` with a readable
 *                message (the backend sends `message` as string OR string[]).
 *
 * After the response interceptor, calls resolve to the *payload itself*, not
 * an AxiosResponse. The typed `http` helpers below encode that so callers get
 * honest types instead of casting at every call site.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => (res.data?.data !== undefined ? res.data.data : res.data),
  (error) => {
    const body = error.response?.data
    const raw = body?.message ?? error.message ?? 'Request failed'
    const message = Array.isArray(raw) ? raw.join(', ') : String(raw)

    // Token missing/expired/invalid — drop the session. AuthContext listens
    // for the resulting event and bounces the user to /login.
    if (error.response?.status === 401) {
      clearSession()
    }

    const normalized = new Error(message) as Error & { status?: number }
    normalized.status = error.response?.status
    return Promise.reject(normalized)
  },
)

/**
 * Typed wrappers. `api.get()` is declared by axios as returning
 * AxiosResponse<T>, but our interceptor already unwrapped it — these helpers
 * tell TypeScript the truth once, here, instead of everywhere.
 */
export const http = {
  get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return api.get(url, config) as unknown as Promise<T>
  },
  post<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return api.post(url, body, config) as unknown as Promise<T>
  },
  patch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return api.patch(url, body, config) as unknown as Promise<T>
  },
}

/** Best-effort message extraction for anything thrown at a UI boundary. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return fallback
}