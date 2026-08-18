import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { FullPageLoader } from './FullPageLoader'

/** Keeps signed-in users off /login and /register. */
export function RedirectIfAuthed() {
  const { isAuthenticated, isBootstrapping } = useAuth()

  if (isBootstrapping) return <FullPageLoader label="Restoring your session…" />
  if (isAuthenticated) return <Navigate to="/" replace />

  return <Outlet />
}