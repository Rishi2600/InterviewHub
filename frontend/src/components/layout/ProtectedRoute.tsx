import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import { FullPageLoader } from './FullPageLoader'

/** Gate for any authenticated screen. Remembers where the user was headed so
 *  login can send them back there. */
export function ProtectedRoute() {
  const { isAuthenticated, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) return <FullPageLoader label="Restoring your session…" />

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}

/** Gate for screens only interviewers/admins should reach. The backend
 *  enforces this too — this just avoids offering a guaranteed 403. */
export function RoleRoute() {
  const { user, isBootstrapping } = useAuth()

  if (isBootstrapping) return <FullPageLoader label="Checking permissions…" />

  if (user?.role !== 'interviewer' && user?.role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return <Outlet />
}