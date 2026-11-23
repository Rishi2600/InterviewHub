import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { JoinCodeForm } from './parts'

function JoinPage() {
  const { search } = useLocation()
  return <p>Join page {search}</p>
}

function renderForm() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<JoinCodeForm />} />
        <Route path="/rooms/join" element={<JoinPage />} />
      </Routes>
    </MemoryRouter>,
  )
  return userEvent.setup()
}

describe('Join code form on the landing page', () => {
  it('sends a valid code to the join page, upper-cased', async () => {
    const user = renderForm()
    await user.type(screen.getByLabelText('Have a room code?'), 'k7p3q')
    await user.click(screen.getByRole('button', { name: 'Join room' }))
    expect(await screen.findByText('Join page ?code=K7P3Q')).toBeInTheDocument()
  })

  it('stays put and explains when the code cannot exist', async () => {
    const user = renderForm()
    await user.type(screen.getByLabelText('Have a room code?'), 'K0P1Q')
    await user.click(screen.getByRole('button', { name: 'Join room' }))
    expect(screen.getByText(/without 0, 1, I or O/)).toBeInTheDocument()
    expect(screen.queryByText(/Join page/)).not.toBeInTheDocument()
  })
})
