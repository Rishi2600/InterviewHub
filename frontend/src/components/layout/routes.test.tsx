import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ProtectedRoute, RoleRoute } from './ProtectedRoute'
import { RedirectIfAuthed } from './RedirectIfAuthed'
import { WithAuth, authValue, signedIn, TEST_USER } from '@/test/auth'
import type { AuthContextValue } from '@/context/AuthContext'

/** Shows where login would send the user back to. */
function LoginPage() {
  const from = (useLocation().state as { from?: string } | null)?.from
  return <p>Login page{from ? `, back to ${from}` : ''}</p>
}

function renderAt(path: string, value: AuthContextValue) {
  return render(
    <WithAuth value={value}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<RedirectIfAuthed />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/dashboard" element={<p>Dashboard page</p>} />
            <Route path="/rooms/join" element={<p>Join page</p>} />
            <Route path="/rooms/:id" element={<p>Room page</p>} />
            <Route element={<RoleRoute />}>
              <Route path="/host" element={<p>Host page</p>} />
            </Route>
          </Route>
        </Routes>
      </MemoryRouter>
    </WithAuth>,
  )
}

describe('route guards', () => {
  it('sends a signed-out visitor to the login page', () => {
    renderAt('/rooms/r1', authValue())
    expect(screen.getByText('Login page, back to /rooms/r1')).toBeInTheDocument()
  })

  it('keeps the query, such as a room code, for after login', () => {
    renderAt('/rooms/join?code=K7P3Q', authValue())
    expect(screen.getByText('Login page, back to /rooms/join?code=K7P3Q')).toBeInTheDocument()
  })

  it('shows a loader, not a redirect, while the session is restored', () => {
    renderAt('/rooms/r1', authValue({ isBootstrapping: true }))
    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
    expect(screen.queryByText('Room page')).not.toBeInTheDocument()
  })

  it('lets a signed-in user through', () => {
    renderAt('/rooms/r1', signedIn())
    expect(screen.getByText('Room page')).toBeInTheDocument()
  })

  it('keeps a signed-in user off the login page', () => {
    renderAt('/login', signedIn())
    expect(screen.getByText('Dashboard page')).toBeInTheDocument()
  })

  it('keeps candidates out of host-only pages', () => {
    renderAt('/host', signedIn({ user: { ...TEST_USER, role: 'candidate' } }))
    expect(screen.getByText('Dashboard page')).toBeInTheDocument()

    renderAt('/host', signedIn())
    expect(screen.getByText('Host page')).toBeInTheDocument()
  })
})
