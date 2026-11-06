import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { refreshSession } from '@/lib/api'
import * as apiEndpoints from '@/lib/endpoints'
import { SESSION_CLEARED_EVENT, SESSION_REFRESHED_EVENT, clearSession, setToken } from '@/lib/session'
import type { AuthPayload, Role, User } from '@/types'

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  /** True while the refresh cookie is checked on first load. */
  isBootstrapping: boolean
  login: (email: string, password: string) => Promise<User>
  register: (input: {
    username: string
    email: string
    password: string
    role?: Role
  }) => Promise<User>
  logout: () => void
  /** Merge fields into the cached user (e.g. after an avatar upload). */
  patchUser: (patch: Partial<User>) => void
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isBootstrapping, setIsBootstrapping] = useState(true)

  // On first load, the refresh cookie (if any) restores the session.
  // refreshSession shares one request, so StrictMode's double run is safe.
  useEffect(() => {
    let cancelled = false
    refreshSession()
      .then((payload) => {
        if (!cancelled && payload) setUser(payload.user)
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // The api client clears or refreshes the session from outside React.
  useEffect(() => {
    const onCleared = () => setUser(null)
    const onRefreshed = (event: Event) => setUser((event as CustomEvent<User>).detail)
    window.addEventListener(SESSION_CLEARED_EVENT, onCleared)
    window.addEventListener(SESSION_REFRESHED_EVENT, onRefreshed)
    return () => {
      window.removeEventListener(SESSION_CLEARED_EVENT, onCleared)
      window.removeEventListener(SESSION_REFRESHED_EVENT, onRefreshed)
    }
  }, [])

  const adopt = useCallback(({ accessToken, user: nextUser }: AuthPayload) => {
    setToken(accessToken)
    setUser(nextUser)
    return nextUser
  }, [])

  const login = useCallback(
    async (email: string, password: string) => adopt(await apiEndpoints.login({ email, password })),
    [adopt],
  )

  const register = useCallback(
    async (input: { username: string; email: string; password: string; role?: Role }) =>
      adopt(await apiEndpoints.register(input)),
    [adopt],
  )

  const logout = useCallback(() => {
    // Ends the session on the server; the local session goes either way.
    void apiEndpoints.logout().catch(() => undefined)
    clearSession()
    setUser(null)
  }, [])

  const patchUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => (prev ? { ...prev, ...patch } : prev))
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      isBootstrapping,
      login,
      register,
      logout,
      patchUser,
    }),
    [user, isBootstrapping, login, register, logout, patchUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
