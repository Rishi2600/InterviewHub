/* oxlint-disable react/only-export-components -- test helpers, never hot-reloaded */
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import { AuthContext } from '@/context/AuthContext'
import type { AuthContextValue } from '@/context/AuthContext'
import type { User } from '@/types'

export const TEST_USER: User = {
  id: 'u1',
  username: 'Priya Raman',
  email: 'priya@example.com',
  role: 'interviewer',
  avatarUrl: null,
}

/** A signed-out AuthContext value; override any field per test. */
export function authValue(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return {
    user: null,
    token: null,
    isAuthenticated: false,
    isBootstrapping: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    patchUser: vi.fn(),
    ...overrides,
  }
}

export function signedIn(overrides: Partial<AuthContextValue> = {}): AuthContextValue {
  return authValue({ user: TEST_USER, token: 'token', isAuthenticated: true, ...overrides })
}

export function WithAuth({ value, children }: { value: AuthContextValue; children: ReactNode }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
