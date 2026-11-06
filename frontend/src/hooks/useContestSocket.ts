import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { connectContests } from '@/lib/sockets'
import { useAuth } from './useAuth'
import type { ContestCounts } from '@/types'

/**
 * Live updates for one contest page: entered, started and submitted counts
 * while it runs (never scores), and a signal when results are out, which
 * refreshes that contest's queries so the page moves on by itself.
 */
export function useContestSocket(contestId: string | undefined, enabled = true) {
  const userId = useAuth().user?.id
  const queryClient = useQueryClient()
  const [counts, setCounts] = useState<ContestCounts | null>(null)

  useEffect(() => {
    if (!userId || !contestId || !enabled) return
    const socket = connectContests()

    const onConnect = () => {
      // Again on every reconnect: the server forgets rooms on disconnect.
      socket
        .emitWithAck('contest:watch', { contestId })
        .then((ack: { ok?: boolean; counts?: ContestCounts }) => {
          if (ack?.counts) setCounts(ack.counts)
        })
        .catch(() => undefined)
    }
    const onCounts = (payload: ContestCounts) => {
      if (payload.contestId === contestId) setCounts(payload)
    }
    const onFinalized = (payload: { contestId: string }) => {
      if (payload.contestId !== contestId) return
      void queryClient.invalidateQueries({ queryKey: ['contest', contestId] })
      void queryClient.invalidateQueries({ queryKey: ['contests'] })
    }

    socket.on('connect', onConnect)
    socket.on('contest:counts', onCounts)
    socket.on('contest:finalized', onFinalized)
    return () => {
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [userId, contestId, enabled, queryClient])

  return counts
}
