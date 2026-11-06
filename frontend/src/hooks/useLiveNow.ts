import { useQuery } from '@tanstack/react-query'
import { listContests, listRooms } from '@/lib/endpoints'
import { useAuth } from './useAuth'

/** The caller's running rooms and contests, for the sidebar and dashboard. */
export function useLiveNow() {
  const { user } = useAuth()
  const rooms = useQuery({
    queryKey: ['rooms', 'active'],
    queryFn: () => listRooms({ state: 'active', limit: 50 }),
    enabled: Boolean(user),
  })
  const contests = useQuery({
    queryKey: ['contests', 'active'],
    queryFn: () => listContests({ state: 'active', limit: 50 }),
    enabled: Boolean(user),
  })
  return {
    rooms: rooms.data?.items ?? [],
    contests: contests.data?.items ?? [],
  }
}
