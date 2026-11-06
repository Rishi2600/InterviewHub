import { useInfiniteQuery } from '@tanstack/react-query'
import type { Page } from '@/types'

/**
 * A list loaded one page at a time with a "Show more" button. Keyed under
 * `key`, so invalidating ['rooms'] or ['contests'] refreshes it.
 */
export function usePagedList<T>(key: string, fetchPage: (cursor?: string) => Promise<Page<T>>, enabled: boolean) {
  const query = useInfiniteQuery({
    queryKey: [key, 'pages'],
    queryFn: ({ pageParam }) => fetchPage(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  })
  const pages = query.data?.pages ?? []
  return {
    items: pages.flatMap((p) => p.items),
    // Totals for the whole list, the same on every page.
    counts: pages[0]?.counts ?? {},
    more: {
      hasMore: query.hasNextPage,
      loading: query.isFetchingNextPage,
      load: () => void query.fetchNextPage(),
    },
  }
}

export type MoreControl = ReturnType<typeof usePagedList>['more']
