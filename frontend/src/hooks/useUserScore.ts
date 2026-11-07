import { useQuery } from '@tanstack/react-query'
import { getUserScore } from '@/lib/endpoints'
import { errorStatus } from '@/lib/api'

/** A user's score section data, shared by the profile header and the section. */
export function useUserScore(userId: string | undefined) {
  return useQuery({
    queryKey: ['users', userId, 'score'],
    queryFn: () => getUserScore(userId!),
    enabled: !!userId,
    // Not allowed or no such user: asking again will not change that.
    retry: (count, err) => count < 1 && (errorStatus(err) ?? 500) >= 500,
  })
}
