import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import * as apiEndpoints from '@/lib/endpoints'
import {
  SESSION_CLEARED_EVENT,
  clearSession,
  getToken,
  getUser,
  saveSession,
  saveUser,
} from '@/lib/session'
import type { Role, User } from '@/types'

export interface AuthContextValue {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  /** True while we confirm a persisted token against `/auth/me` on boot. */
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
  const [user, setUser] = useState<User | null>(() => getUser())
  const [token, setToken] = useState<string | null>(() => getToken())
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(() => getToken() !== null)

  // On boot, confirm a persisted token is still valid. If it isn't, the axios
  // 401 interceptor clears the session and the listener below picks it up.
  useEffect(() => {
    let cancelled = false
    // No token: isBootstrapping already started as false.
    if (!getToken()) return
    apiEndpoints
      .me()
      .then((fresh) => {
        if (cancelled) return
        // /auth/me omits avatarUrl; keep whatever we already cached for it.
        setUser((prev) => {
          const merged = { ...fresh, avatarUrl: prev?.avatarUrl ?? null }
          saveUser(merged)
          return merged
        })
      })
      .catch(() => {
        if (cancelled) return
        clearSession()
        setUser(null)
        setToken(null)
      })
      .finally(() => {
        if (!cancelled) setIsBootstrapping(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // The axios interceptor can clear the session from outside React on any 401.
  useEffect(() => {
    const onCleared = () => {
      setUser(null)
      setToken(null)
    }
    window.addEventListener(SESSION_CLEARED_EVENT, onCleared)
    return () => window.removeEventListener(SESSION_CLEARED_EVENT, onCleared)
  }, [])

  const adopt = useCallback((accessToken: string, nextUser: User) => {
    saveSession(accessToken, nextUser)
    setToken(accessToken)
    setUser(nextUser)
    return nextUser
  }, [])

  const login = useCallback(
    async (email: string, password: string) => {
      const { accessToken, user: nextUser } = await apiEndpoints.login({ email, password })
      return adopt(accessToken, nextUser)
    },
    [adopt],
  )

  const register = useCallback(
    async (input: { username: string; email: string; password: string; role?: Role }) => {
      const { accessToken, user: nextUser } = await apiEndpoints.register(input)
      return adopt(accessToken, nextUser)
    },
    [adopt],
  )

  const logout = useCallback(() => {
    clearSession()
    setUser(null)
    setToken(null)
  }, [])

  const patchUser = useCallback((patch: Partial<User>) => {
    setUser((prev) => {
      if (!prev) return prev
      const merged = { ...prev, ...patch }
      saveUser(merged)
      return merged
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token && user),
      isBootstrapping,
      login,
      register,
      logout,
      patchUser,
    }),
    [user, token, isBootstrapping, login, register, logout, patchUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}