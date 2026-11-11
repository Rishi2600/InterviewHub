import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/context/AuthContext'
import { AppShell } from '@/components/layout/AppShell'
import { ProtectedRoute, RoleRoute } from '@/components/layout/ProtectedRoute'
import { RedirectIfAuthed } from '@/components/layout/RedirectIfAuthed'
import { FullPageLoader } from '@/components/layout/FullPageLoader'
import { PublicOrAppShell } from '@/components/layout/PublicShell'

// Route-level code splitting: the socket-heavy Room/Contest screens stay out
// of the initial bundle, so login loads fast.
const Login = lazy(() => import('@/pages/Login').then((m) => ({ default: m.Login })))
const Register = lazy(() => import('@/pages/Register').then((m) => ({ default: m.Register })))
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const JoinRoom = lazy(() => import('@/pages/JoinRoom').then((m) => ({ default: m.JoinRoom })))
const Room = lazy(() => import('@/pages/Room').then((m) => ({ default: m.Room })))
const ContestsBrowse = lazy(() => import('@/pages/ContestsBrowse').then((m) => ({ default: m.ContestsBrowse })))
const ContestDetails = lazy(() => import('@/pages/ContestDetails').then((m) => ({ default: m.ContestDetails })))
const ContestEditor = lazy(() => import('@/pages/ContestEditor').then((m) => ({ default: m.ContestEditor })))
const ContestWorkspace = lazy(() => import('@/pages/ContestWorkspace').then((m) => ({ default: m.ContestWorkspace })))
const ContestResults = lazy(() => import('@/pages/ContestResults').then((m) => ({ default: m.ContestResults })))
const Profile = lazy(() => import('@/pages/Profile').then((m) => ({ default: m.Profile })))
const Practice = lazy(() => import('@/pages/Practice').then((m) => ({ default: m.Practice })))
const UserProfile = lazy(() => import('@/pages/UserProfile').then((m) => ({ default: m.UserProfile })))
const NotFound = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFound })))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <Suspense fallback={<FullPageLoader />}>
              <Routes>
                {/* Public */}
                <Route element={<RedirectIfAuthed />}>
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                </Route>

                {/* Contests are public: the browse page works signed out. */}
                <Route element={<PublicOrAppShell />}>
                  <Route path="/contests" element={<ContestsBrowse />} />
                </Route>

                {/* Authenticated */}
                <Route element={<ProtectedRoute />}>
                  {/* Focus screens, without the sidebar. */}
                  <Route path="/contests/:id/play" element={<ContestWorkspace />} />
                  <Route path="/rooms/:id" element={<Room />} />
                  <Route element={<AppShell />}>
                    <Route index element={<Dashboard />} />
                    <Route path="/rooms/join" element={<JoinRoom />} />
                    <Route path="/contests/:id" element={<ContestDetails />} />
                    <Route path="/contests/:id/results" element={<ContestResults />} />
                    <Route element={<RoleRoute />}>
                      <Route path="/contests/:id/edit" element={<ContestEditor />} />
                    </Route>
                    <Route path="/practice" element={<Practice />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/users/:id" element={<UserProfile />} />

                    {/* Host-only area. Kept as a nested guard so adding
                        interviewer-only screens later needs no new plumbing. */}
                    <Route element={<RoleRoute />}>
                      <Route path="/host" element={<Navigate to="/" replace />} />
                    </Route>

                    <Route path="*" element={<NotFound />} />
                  </Route>
                </Route>
              </Routes>
            </Suspense>

            <Toaster position="bottom-right" />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}