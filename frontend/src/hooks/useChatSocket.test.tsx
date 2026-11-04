import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { useChatSocket } from './useChatSocket'
import { WithAuth, signedIn } from '@/test/auth'

/** Minimal stand-in for a socket.io client socket. */
class FakeSocket {
  connected = false
  handlers = new Map<string, (...args: unknown[]) => void>()
  emit = vi.fn()
  on(event: string, handler: (...args: unknown[]) => void) {
    this.handlers.set(event, handler)
    return this
  }
  /** Simulates an event arriving from the server. */
  fire(event: string, ...args: unknown[]) {
    act(() => this.handlers.get(event)?.(...args))
  }
  removeAllListeners = vi.fn()
  disconnect = vi.fn()
}

let socket: FakeSocket
vi.mock('@/lib/sockets', () => ({ connectChat: () => socket }))
const toastError = vi.fn()
vi.mock('sonner', () => ({ toast: { error: (msg: string) => toastError(msg) } }))

const wrapper = ({ children }: { children: ReactNode }) => (
  <WithAuth value={signedIn()}>{children}</WithAuth>
)

const message = (id: string, senderId: string | null = 'u2') => ({
  id,
  roomId: 'r1',
  senderId,
  senderName: 'Ada',
  content: `message ${id}`,
  type: senderId ? 'user' : 'system',
  createdAt: '2026-11-04T14:00:00Z',
})

beforeEach(() => {
  socket = new FakeSocket()
  toastError.mockClear()
})

describe('useChatSocket', () => {
  it('joins the room on every connect, including reconnects', () => {
    const { result } = renderHook(() => useChatSocket('r1'), { wrapper })
    expect(result.current.status).toBe('connecting')

    socket.fire('connect')
    socket.fire('disconnect')
    socket.fire('connect')

    const joins = socket.emit.mock.calls.filter(([event]) => event === 'room:join')
    expect(joins).toHaveLength(2)
    expect(joins[0][1]).toEqual({ roomId: 'r1' })
    expect(result.current.status).toBe('connected')
  })

  it('loads history, appends new messages and ignores duplicates', () => {
    const { result } = renderHook(() => useChatSocket('r1'), { wrapper })
    socket.fire('chat:history', [message('m1')])
    socket.fire('chat:message', message('m2'))
    socket.fire('chat:message', message('m2'))
    socket.fire('chat:system', message('m3', null))
    expect(result.current.messages.map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
  })

  it('tracks who is typing until they stop or send a message', () => {
    const { result } = renderHook(() => useChatSocket('r1'), { wrapper })
    socket.fire('chat:typing', { userId: 'u2', username: 'Ada' })
    socket.fire('chat:typing', { userId: 'u3', username: 'Marcus' })
    expect(result.current.typingUsers.map((u) => u.username)).toEqual(['Ada', 'Marcus'])

    socket.fire('chat:stop_typing', { userId: 'u3' })
    socket.fire('chat:message', message('m1', 'u2'))
    expect(result.current.typingUsers).toEqual([])
  })

  it('follows the pinned question', () => {
    const { result } = renderHook(() => useChatSocket('r1'), { wrapper })
    socket.fire('question:pinned', { question: 'Write debounce' })
    expect(result.current.pinnedQuestion).toBe('Write debounce')
    socket.fire('question:unpinned')
    expect(result.current.pinnedQuestion).toBeNull()
  })

  it('sends trimmed messages and skips empty ones', () => {
    const { result } = renderHook(() => useChatSocket('r1'), { wrapper })
    act(() => result.current.sendMessage('  hello  '))
    act(() => result.current.sendMessage('   '))
    const sends = socket.emit.mock.calls.filter(([event]) => event === 'chat:send')
    expect(sends).toEqual([['chat:send', { roomId: 'r1', content: 'hello' }]])
  })

  it('shows server errors and connection failures as toasts', () => {
    const { result } = renderHook(() => useChatSocket('r1'), { wrapper })
    socket.fire('error', { message: 'Slow down' })
    socket.fire('connect_error', new Error('Too many open connections'))
    expect(toastError).toHaveBeenCalledWith('Slow down')
    expect(toastError).toHaveBeenCalledWith('Chat connection failed: Too many open connections')
    expect(result.current.status).toBe('error')
  })

  it('leaves the room and closes the socket on unmount', () => {
    const { unmount } = renderHook(() => useChatSocket('r1'), { wrapper })
    socket.connected = true
    unmount()
    expect(socket.emit).toHaveBeenCalledWith('room:leave', { roomId: 'r1' })
    expect(socket.disconnect).toHaveBeenCalled()
  })
})
