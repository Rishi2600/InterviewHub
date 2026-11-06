import { afterEach, describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { api, authClient, http, refreshSession } from './api'
import { clearSession, getToken, setToken } from './session'
import { TEST_USER } from '@/test/auth'
import { fakeJwt } from '@/test/jwt'

const originalAdapter = api.defaults.adapter
const originalAuthAdapter = authClient.defaults.adapter

/** Makes /auth/refresh answer with a new token, or fail; counts the calls. */
function refreshAnswers(token: string | null) {
  const calls = { count: 0 }
  authClient.defaults.adapter = async (config) => {
    calls.count += 1
    if (!token) {
      const response = { data: {}, status: 401, statusText: '401', headers: {}, config }
      throw new AxiosError('Unauthorized', '401', config, null, response)
    }
    const data = { success: true, data: { accessToken: token, user: TEST_USER } }
    return { data, status: 200, statusText: 'OK', headers: {}, config }
  }
  return calls
}

/** Records the Authorization header of each request and answers in turn. */
function serverSeeing(statuses: number[]) {
  const seen: unknown[] = []
  api.defaults.adapter = async (config) => {
    seen.push(config.headers.Authorization)
    const status = statuses[seen.length - 1] ?? 200
    const response = { data: { success: true, data: { ok: true } }, status, statusText: String(status), headers: {}, config }
    if (status >= 400) throw new AxiosError('Request failed', String(status), config, null, response)
    return response
  }
  return seen
}

/** Answers every request with this status, body and headers. */
function respond(status: number, data: unknown, headers: Record<string, string> = {}) {
  const adapter: AxiosAdapter = async (config: InternalAxiosRequestConfig) => {
    const response = {
      data,
      status,
      statusText: String(status),
      headers: new AxiosHeaders(headers),
      config,
    }
    if (status >= 400) {
      throw new AxiosError('Request failed', String(status), config, null, response)
    }
    return response
  }
  api.defaults.adapter = adapter
}

afterEach(() => {
  api.defaults.adapter = originalAdapter
  authClient.defaults.adapter = originalAuthAdapter
  clearSession()
})

describe('api client', () => {
  it('unwraps the { success, data } envelope', async () => {
    respond(200, { success: true, data: { id: 'r1' }, timestamp: 'now' })
    await expect(http.get('/rooms/r1')).resolves.toEqual({ id: 'r1' })
  })

  it('sends the access token as a Bearer header', async () => {
    const token = fakeJwt(600)
    setToken(token)
    const seen = serverSeeing([200])
    await http.get('/rooms')
    expect(seen).toEqual([`Bearer ${token}`])
  })

  it('refreshes a token that is about to expire before sending', async () => {
    setToken(fakeJwt(10))
    const fresh = fakeJwt(900)
    refreshAnswers(fresh)
    const seen = serverSeeing([200])
    await http.get('/rooms')
    expect(seen).toEqual([`Bearer ${fresh}`])
  })

  it('shares one refresh between callers', async () => {
    const calls = refreshAnswers(fakeJwt(900))
    await Promise.all([refreshSession(), refreshSession(), refreshSession()])
    expect(calls.count).toBe(1)
  })

  it('joins an array of validation messages into one', async () => {
    respond(400, { message: ['email must be an email', 'password is too short'] })
    await expect(http.post('/auth/login')).rejects.toThrow(
      'email must be an email, password is too short',
    )
  })

  it('refreshes and retries once on 401', async () => {
    setToken(fakeJwt(600))
    const fresh = fakeJwt(900)
    refreshAnswers(fresh)
    const seen = serverSeeing([401, 200])
    await expect(http.get('/rooms')).resolves.toEqual({ ok: true })
    expect(seen[1]).toBe(`Bearer ${fresh}`)
  })

  it('clears the session when the refresh fails too', async () => {
    setToken(fakeJwt(600))
    refreshAnswers(null)
    serverSeeing([401])
    await expect(http.get('/rooms')).rejects.toMatchObject({ status: 401 })
    expect(getToken()).toBeNull()
  })

  it('turns a 429 into a wait message using the longest Retry-After', async () => {
    respond(429, { message: 'Too many requests' }, { 'retry-after': '40', 'retry-after-hourly': '1800' })
    await expect(http.post('/auth/login')).rejects.toThrow('Too many attempts, try again in 30 min')

    respond(429, { message: 'Too many requests' }, { 'retry-after': '12' })
    await expect(http.post('/auth/login')).rejects.toThrow('Too many attempts, try again in 12 s')
  })
})
