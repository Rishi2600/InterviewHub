import { useQuery } from '@tanstack/react-query'
import { getUserScore } from '@/lib/endpoints'

/** A user's score section data, shared by the profile header and the section. */
export function useUserScore(userId: string | undefined) {
  return useQuery({
    queryKey: ['users', userId, 'score'],
    queryFn: () => getUserScore(userId!),
    enabled: !!userId,
  })
}
