import axios from 'axios'
import type { AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios'
import { announceRefresh, clearSession, getToken, setToken, tokenExpiry } from './session'
import type { AuthPayload } from '@/types'

/**
 * The one axios instance. Its interceptors do the boring work:
 *
 *  1. request  — attaches an access token, refreshing it first if it is about
 *                to expire.
 *  2. response — unwraps the `{ success, data, timestamp }` envelope, retries
 *                once after a refresh on 401, and normalizes errors into a
 *                plain `Error` with a readable message.
 *
 * After the response interceptor, calls resolve to the *payload itself*, not
 * an AxiosResponse. The typed `http` helpers below encode that so callers get
 * honest types instead of casting at every call site.
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // Lets the browser store and send the refresh cookie (scoped to /auth).
  withCredentials: true,
})

// A bare client for /auth/refresh, so a failed refresh never loops through
// the interceptors above. Exported for tests only.
export const authClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
  withCredentials: true,
})

let refreshing: Promise<AuthPayload | null> | null = null

/**
 * Exchanges the refresh cookie for a new access token. Calls made while one
 * is running share it, and the browser lock keeps two tabs from rotating the
 * same cookie at once. Resolves to null when there is no valid session.
 */
export function refreshSession(): Promise<AuthPayload | null> {
  refreshing ??= runExclusive(async () => {
    try {
      const res = await authClient.post<{ data: AuthPayload }>('/auth/refresh')
      const payload = res.data.data
      setToken(payload.accessToken)
      announceRefresh(payload.user)
      return payload
    } catch {
      clearSession()
      return null
    }
  }).finally(() => {
    refreshing = null
  })
  return refreshing
}

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request('interviewhub-refresh', task) : task()
}

/** The current access token, refreshed first if it expires within 30 s.
 *  Null when signed out; it never starts a session on its own. */
export async function getFreshToken(): Promise<string | null> {
  const token = getToken()
  if (!token) return null
  if (tokenExpiry(token) * 1000 > Date.now() + 30_000) return token
  return (await refreshSession())?.accessToken ?? null
}

const isAuthRoute = (url = '') => url.startsWith('/auth/')

api.interceptors.request.use(async (config) => {
  const token = isAuthRoute(config.url) ? getToken() : await getFreshToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => (res.data?.data !== undefined ? res.data.data : res.data),
  async (error) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retried?: boolean }) | undefined

    // The access token was rejected: refresh once and replay the request.
    if (error.response?.status === 401 && original && !original._retried && !isAuthRoute(original.url) && getToken()) {
      original._retried = true
      const refreshed = await refreshSession()
      if (refreshed) return api(original)
    }

    const body = error.response?.data
    const raw = body?.message ?? error.message ?? 'Request failed'
    let message = Array.isArray(raw) ? raw.join(', ') : String(raw)

    if (error.response?.status === 429) {
      message = `Too many attempts, try again in ${formatWait(retryAfter(error.response.headers))}`
    }

    // Still unauthorized: drop the session. AuthContext listens for the
    // resulting event and bounces the user to /login.
    if (error.response?.status === 401 && !isAuthRoute(original?.url)) {
      clearSession()
    }

    const normalized = new Error(message) as Error & { status?: number }
    normalized.status = error.response?.status
    return Promise.reject(normalized)
  },
)

/** Longest wait the server asked for, in seconds (per-minute and hourly limits). */
function retryAfter(headers: Record<string, unknown>): number {
  const waits = [headers['retry-after'], headers['retry-after-hourly']].map(Number)
  return Math.max(1, ...waits.filter((n) => Number.isFinite(n)))
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.ceil(seconds / 60)
  return minutes < 60 ? `${minutes} min` : `${Math.ceil(minutes / 60)} h`
}

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
  put<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
    return api.put(url, body, config) as unknown as Promise<T>
  },
  delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return api.delete(url, config) as unknown as Promise<T>
  },
}

/** The HTTP status of a failed call, when there was a response. */
export function errorStatus(err: unknown): number | undefined {
  return (err as { status?: number } | null)?.status
}

/** Best-effort message extraction for anything thrown at a UI boundary. */
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error && err.message) return err.message
  if (typeof err === 'string' && err) return err
  return fallback
}