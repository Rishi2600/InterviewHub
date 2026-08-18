import { useContext } from 'react'
import { AuthContext } from '@/context/AuthContext'
import type { AuthContextValue } from '@/context/AuthContext'

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used inside an <AuthProvider>')
  }
  return ctx
}

/** True for roles allowed to create rooms/contests and award scores. */
export function useCanHost(): boolean {
  const { user } = useAuth()
  return user?.role === 'interviewer' || user?.role === 'admin'
}