import { useQuery } from '@tanstack/react-query'
import { browseContests, listRooms } from '@/lib/endpoints'
import { useAuth } from './useAuth'

/** The caller's running rooms and contests, for the sidebar and dashboard. */
export function useLiveNow() {
  const { user } = useAuth()
  const rooms = useQuery({
    queryKey: ['rooms', 'active'],
    queryFn: () => listRooms({ state: 'active', limit: 50 }),
    enabled: Boolean(user),
  })
  // Live contests the user hosts or has joined.
  const contests = useQuery({
    queryKey: ['contests', 'browse', 'live', 'mine', user?.id],
    queryFn: () => browseContests({ phase: 'live', limit: 50 }),
    enabled: Boolean(user),
    refetchInterval: 60_000,
  })
  return {
    rooms: rooms.data?.items ?? [],
    contests: (contests.data?.items ?? []).filter((c) => c.viewer?.joined || c.viewer?.hosting),
  }
}
