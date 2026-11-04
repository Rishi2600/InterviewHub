import { describe, expect, it, vi } from 'vitest'
import {
  SESSION_CLEARED_EVENT,
  clearSession,
  getToken,
  getUser,
  saveSession,
} from './session'
import { TEST_USER } from '@/test/auth'

describe('session storage', () => {
  it('saves and reads the token and user', () => {
    saveSession('abc', TEST_USER)
    expect(getToken()).toBe('abc')
    expect(getUser()).toEqual(TEST_USER)
  })

  it('treats a corrupted user entry as no session', () => {
    localStorage.setItem('interviewhub.user', '{not json')
    expect(getUser()).toBeNull()
    expect(localStorage.getItem('interviewhub.user')).toBeNull()
  })

  it('announces a cleared session only when there was one', () => {
    const listener = vi.fn()
    window.addEventListener(SESSION_CLEARED_EVENT, listener)

    clearSession()
    expect(listener).not.toHaveBeenCalled()

    saveSession('abc', TEST_USER)
    clearSession()
    expect(listener).toHaveBeenCalledTimes(1)
    expect(getToken()).toBeNull()

    window.removeEventListener(SESSION_CLEARED_EVENT, listener)
  })
})
