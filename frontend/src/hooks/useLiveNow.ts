import { useQuery } from '@tanstack/react-query'
import { listContests, listRooms } from '@/lib/endpoints'
import { useAuth } from './useAuth'

/** The user's rooms and contests that are running right now. Shares the
 *  dashboard's queries, so it costs no extra requests. */
export function useLiveNow() {
  const { user } = useAuth()
  const rooms = useQuery({ queryKey: ['rooms'], queryFn: listRooms, enabled: Boolean(user) })
  const contests = useQuery({
    queryKey: ['contests'],
    queryFn: () => listContests(),
    enabled: Boolean(user),
  })
  return {
    rooms: (rooms.data ?? []).filter((r) => r.state === 'active'),
    contests: (contests.data ?? []).filter((c) => c.state === 'active'),
  }
}
