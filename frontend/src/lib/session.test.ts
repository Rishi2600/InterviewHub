import { describe, expect, it, vi } from 'vitest'
import { SESSION_CLEARED_EVENT, clearSession, getToken, setToken, tokenExpiry } from './session'
import { fakeJwt } from '@/test/jwt'

describe('session', () => {
  it('keeps the access token in memory, not in localStorage', () => {
    setToken('abc')
    expect(getToken()).toBe('abc')
    expect(JSON.stringify(localStorage)).not.toContain('abc')
    clearSession()
  })

  it('announces a cleared session only when there was one', () => {
    const listener = vi.fn()
    window.addEventListener(SESSION_CLEARED_EVENT, listener)

    clearSession()
    expect(listener).not.toHaveBeenCalled()

    setToken('abc')
    clearSession()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getToken()).toBeNull()

    window.removeEventListener(SESSION_CLEARED_EVENT, listener)
  })

  it('reads the expiry from a token, and 0 from garbage', () => {
    const exp = tokenExpiry(fakeJwt(60))
    expect(exp).toBeGreaterThan(Date.now() / 1000)
    expect(tokenExpiry('not-a-jwt')).toBe(0)
  })
})
