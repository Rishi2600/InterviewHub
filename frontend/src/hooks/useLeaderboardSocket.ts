import { useEffect, useRef, useState } from 'react'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { connectLeaderboard } from '@/lib/sockets'
import type { ConnectionStatus } from '@/lib/sockets'
import { useAuth } from './useAuth'
import type { LeaderboardRow, LeaderboardUpdate, SocketError } from '@/types'

/**
 * Subscribes to `/leaderboard` for one contest. The server pushes
 * `leaderboard:update` on every score change, so there is no polling — and it
 * sends the current board immediately on join, which doubles as our initial load.
 */
export function useLeaderboardSocket(contestId: string | undefined) {
  // Keyed on the user, not the token, so refreshes do not rebuild the socket.
  const currentUserId = useAuth().user?.id
  const [status, setStatus] = useState<ConnectionStatus>('connecting')
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [hasLoaded, setHasLoaded] = useState(false)
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    if (!currentUserId || !contestId) return

    const socket = connectLeaderboard()
    socketRef.current = socket
    // Status mirrors the socket we just opened (an external system).
    // oxlint-disable-next-line react/set-state-in-effect
    setStatus('connecting')
    setHasLoaded(false)

    const onConnect = () => {
      setStatus('connected')
      // Re-subscribe on reconnect too — server-side room membership is lost.
      socket.emit('leaderboard:join', { contestId })
    }

    const onDisconnect = () => setStatus('disconnected')

    const onConnectError = (err: Error) => {
      setStatus('error')
      toast.error(`Leaderboard connection failed: ${err.message}`)
    }

    const onUpdate = (payload: LeaderboardUpdate) => {
      // Ignore stray updates for other contests sharing the socket.
      if (payload.contestId !== contestId) return
      setRows(payload.top ?? [])
      setHasLoaded(true)
    }

    const onError = (err: SocketError) => toast.error(err?.message ?? 'Leaderboard error')

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('leaderboard:update', onUpdate)
    socket.on('error', onError)

    return () => {
      if (socket.connected) socket.emit('leaderboard:leave', { contestId })
      socket.removeAllListeners()
      socket.disconnect()
      socketRef.current = null
    }
  }, [currentUserId, contestId])

  return { status, rows, hasLoaded }
}