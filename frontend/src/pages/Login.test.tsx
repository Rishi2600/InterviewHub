import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { Login } from './Login'
import { WithAuth, authValue, TEST_USER } from '@/test/auth'

function renderLogin(login = vi.fn().mockResolvedValue(TEST_USER), from?: string) {
  render(
    <WithAuth value={authValue({ login })}>
      <MemoryRouter initialEntries={[{ pathname: '/login', state: from ? { from } : null }]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<p>Dashboard page</p>} />
          <Route path="/rooms/r1" element={<p>Room page</p>} />
        </Routes>
      </MemoryRouter>
    </WithAuth>,
  )
  return login
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Email'), email)
  await user.type(screen.getByLabelText('Password'), password)
  await user.click(screen.getByRole('button', { name: 'Sign in' }))
}

describe('Login page', () => {
  it('signs in and returns to the page the user was headed for', async () => {
    const login = renderLogin(undefined, '/rooms/r1')
    await fillAndSubmit('priya@example.com', 'secret123')
    expect(login).toHaveBeenCalledWith('priya@example.com', 'secret123')
    expect(await screen.findByText('Room page')).toBeInTheDocument()
  })

  it('validates the fields before calling the API', async () => {
    const login = renderLogin()
    await fillAndSubmit('not-an-email', '123')
    expect(await screen.findByText('Enter a valid email address')).toBeInTheDocument()
    expect(screen.getByText('Password must be at least 6 characters')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('shows the server error when sign-in fails', async () => {
    renderLogin(vi.fn().mockRejectedValue(new Error('Invalid credentials')))
    await fillAndSubmit('priya@example.com', 'wrongpass')
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid credentials')
  })
})
