import { useCallback, useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { connectChat } from '@/lib/sockets'
import type { ConnectionStatus } from '@/lib/sockets'
import { useAuth } from './useAuth'
import type { Message, SocketError } from '@/types'

interface TypingUser {
  userId: string
  username: string
}

/**
 * Owns one `/chat` socket for the lifetime of a room screen.
 *
 * Reconnect handling matters here: socket.io transparently re-establishes the
 * connection, but the server-side room membership is gone, so we re-emit
 * `room:join` on every `connect` — not just the first.
 */
export function useChatSocket(roomId: string | undefined) {
  const { token } = useAuth()
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [messages, setMessages] = useState<Message[]>([])
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([])
  const [pinnedQuestion, setPinnedQuestion] = useState<string | null>(null)

  const socketRef = useRef<Socket | null>(null)
  // Per-user timers that clear a stale "typing" if stop_typing never arrives.
  const typingTimers = useRef<Map<string, number>>(new Map())

  useEffect(() => {
    if (!token || !roomId) return

    const socket = connectChat(token)
    socketRef.current = socket
    // Status mirrors the socket we just opened (an external system).
    // oxlint-disable-next-line react/set-state-in-effect
    setStatus('connecting')

    const onConnect = () => {
      setStatus('connected')
      // Re-join on every connect, including reconnects.
      socket.emit('room:join', { roomId }, (ack?: { pinnedQuestion?: string | null }) => {
        if (ack && 'pinnedQuestion' in ack) {
          setPinnedQuestion(ack.pinnedQuestion ?? null)
        }
      })
    }

    const onDisconnect = () => setStatus('disconnected')

    const onConnectError = (err: Error) => {
      setStatus('error')
      toast.error(`Chat connection failed: ${err.message}`)
    }

    const onHistory = (history: Message[]) => setMessages(history ?? [])

    const onMessage = (msg: Message) => {
      setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
      // A message from someone implies they've stopped typing.
      if (msg.senderId) {
        setTypingUsers((prev) => prev.filter((u) => u.userId !== msg.senderId))
      }
    }

    const onTyping = ({ userId, username }: TypingUser) => {
      setTypingUsers((prev) =>
        prev.some((u) => u.userId === userId) ? prev : [...prev, { userId, username }],
      )
      const timers = typingTimers.current
      const existing = timers.get(userId)
      if (existing) window.clearTimeout(existing)
      timers.set(
        userId,
        window.setTimeout(() => {
          setTypingUsers((prev) => prev.filter((u) => u.userId !== userId))
          timers.delete(userId)
        }, 4000),
      )
    }

    const onStopTyping = ({ userId }: { userId: string }) => {
      setTypingUsers((prev) => prev.filter((u) => u.userId !== userId))
      const timer = typingTimers.current.get(userId)
      if (timer) {
        window.clearTimeout(timer)
        typingTimers.current.delete(userId)
      }
    }

    const onPinned = ({ question }: { question: string | null }) =>
      setPinnedQuestion(question ?? null)
    const onUnpinned = () => setPinnedQuestion(null)
    const onError = (err: SocketError) => toast.error(err?.message ?? 'Chat error')

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('chat:history', onHistory)
    socket.on('chat:message', onMessage)
    socket.on('chat:system', onMessage)
    socket.on('chat:typing', onTyping)
    socket.on('chat:stop_typing', onStopTyping)
    socket.on('question:pinned', onPinned)
    socket.on('question:unpinned', onUnpinned)
    socket.on('error', onError)

    const timers = typingTimers.current
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      timers.clear()
      if (socket.connected) socket.emit('room:leave', { roomId })
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [token, roomId])

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim()
      if (!trimmed || !roomId) return
      socketRef.current?.emit('chat:send', { roomId, content: trimmed })
    },
    [roomId],
  )

  const startTyping = useCallback(() => {
    if (!roomId) return
    socketRef.current?.emit('chat:typing', { roomId })
  }, [roomId])

  const stopTyping = useCallback(() => {
    if (!roomId) return
    socketRef.current?.emit('chat:stop_typing', { roomId })
  }, [roomId])

  const pinQuestion = useCallback(
    (question: string) => {
      if (!roomId) return
      socketRef.current?.emit('question:pin', { roomId, question })
    },
    [roomId],
  )

  const unpinQuestion = useCallback(() => {
    if (!roomId) return
    socketRef.current?.emit('question:unpin', { roomId })
  }, [roomId])

  return {
    status,
    messages,
    typingUsers,
    pinnedQuestion,
    setPinnedQuestion,
    sendMessage,
    startTyping,
    stopTyping,
    pinQuestion,
    unpinQuestion,
  }
}