import { afterEach, describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import { api, http } from './api'
import { getToken, saveSession } from './session'
import { TEST_USER } from '@/test/auth'

const originalAdapter = api.defaults.adapter

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
})

describe('api client', () => {
  it('unwraps the { success, data } envelope', async () => {
    respond(200, { success: true, data: { id: 'r1' }, timestamp: 'now' })
    await expect(http.get('/rooms/r1')).resolves.toEqual({ id: 'r1' })
  })

  it('sends the saved token as a Bearer header', async () => {
    saveSession('secret', TEST_USER)
    let auth: unknown
    api.defaults.adapter = async (config) => {
      auth = config.headers.Authorization
      return { data: {}, status: 200, statusText: 'OK', headers: {}, config }
    }
    await http.get('/auth/me')
    expect(auth).toBe('Bearer secret')
  })

  it('joins an array of validation messages into one', async () => {
    respond(400, { message: ['email must be an email', 'password is too short'] })
    await expect(http.post('/auth/login')).rejects.toThrow(
      'email must be an email, password is too short',
    )
  })

  it('clears the session on 401', async () => {
    saveSession('expired', TEST_USER)
    respond(401, { message: 'Unauthorized' })
    await expect(http.get('/auth/me')).rejects.toMatchObject({ status: 401 })
    expect(getToken()).toBeNull()
  })

  it('turns a 429 into a wait message using the longest Retry-After', async () => {
    respond(429, { message: 'Too many requests' }, { 'retry-after': '40', 'retry-after-hourly': '1800' })
    await expect(http.post('/auth/login')).rejects.toThrow('Too many attempts, try again in 30 min')

    respond(429, { message: 'Too many requests' }, { 'retry-after': '12' })
    await expect(http.post('/auth/login')).rejects.toThrow('Too many attempts, try again in 12 s')
  })
})
