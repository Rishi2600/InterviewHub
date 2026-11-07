import { useState } from 'react'
import { Link } from 'react-router-dom'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getUserContests } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { formatChange, formatDay } from '@/lib/score'
import { Button } from '@/components/ui/button'
import { Panel } from './Panel'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { ContestHistoryItem } from '@/types'

const PAGE = 10

function changeColour(change: number) {
  const tenths = Math.round(change * 10)
  return tenths === 0 ? 'text-muted-foreground' : tenths < 0 ? 'text-danger' : 'text-brand'
}

/** Contests the candidate started, newest first, 10 a page. */
export function ContestHistory({ userId }: { userId: string }) {
  // Cursors of the pages visited so far; the last one is the current page.
  const [cursors, setCursors] = useState<(string | undefined)[]>([undefined])
  const cursor = cursors[cursors.length - 1]
  const page = useQuery({
    queryKey: ['users', userId, 'contests', cursor ?? 'first'],
    queryFn: () => getUserContests(userId, cursor, PAGE),
    placeholderData: keepPreviousData,
  })
  const items = page.data?.items ?? []
  const total = page.data?.counts.total ?? 0
  const first = (cursors.length - 1) * PAGE + 1

  return (
    <Panel title="Contest history" extra="newest first">
      {page.isError ? (
        <p className="p-5 text-sm text-danger">{errorMessage(page.error, 'Could not load contest history')}</p>
      ) : page.isPending ? (
        <div className="grid gap-2 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : total === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">No contests yet. Contests show here once they end.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-5 py-2 font-medium">Contest</th>
                  <th className="px-3 py-2 font-medium">Rank</th>
                  <th className="px-3 py-2 font-medium">Ahead of</th>
                  <th className="px-3 py-2 font-medium">Points</th>
                  <th className="px-3 py-2 font-medium">Finish</th>
                  <th className="px-5 py-2 text-right font-medium">Score after</th>
                </tr>
              </thead>
              <tbody>
                {items.map((c) => (
                  <Row key={c.contestId} c={c} />
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t px-5 py-3 text-xs text-muted-foreground">
            <span className="tabular-nums">
              {first}–{first + items.length - 1} of {total}
            </span>
            <span className="flex gap-1">
              <Button variant="outline" size="sm" disabled={cursors.length === 1} onClick={() => setCursors((c) => c.slice(0, -1))}>
                <ChevronLeft aria-hidden />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!page.data?.nextCursor || page.isPlaceholderData}
                onClick={() => setCursors((c) => [...c, page.data!.nextCursor!])}
              >
                Next
                <ChevronRight aria-hidden />
              </Button>
            </span>
          </div>
        </>
      )}
    </Panel>
  )
}

function Row({ c }: { c: ContestHistoryItem }) {
  return (
    <tr className="border-t">
      <td className="px-5 py-2.5">
        <Link to={`/contests/${c.contestId}/results`} className="font-medium hover:underline">
          {c.title}
        </Link>
        <div className="text-xs text-muted-foreground">{formatDay(c.at)}</div>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">
        #{c.rank}
        <span className="text-muted-foreground"> of {c.starters}</span>
      </td>
      <td className="px-3 py-2.5 tabular-nums">{Math.round(c.percentile * 100)}%</td>
      <td className="px-3 py-2.5 tabular-nums">
        {c.points}
        <span className="text-muted-foreground">/{c.totalPoints}</span>
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {c.submitted ? (
          <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-brand">Submitted</span>
        ) : (
          <span className="rounded-md border border-dashed px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Time ran out</span>
        )}
      </td>
      <td className="px-5 py-2.5 text-right whitespace-nowrap tabular-nums">
        {c.scoreAfter === null ? (
          <span className="rounded-md border px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">Unrated</span>
        ) : (
          <>
            {c.scoreAfter.toFixed(1)}
            {c.change !== null && (
              <span className={cn('ml-1 text-xs', changeColour(c.change))}>{formatChange(c.change)}</span>
            )}
          </>
        )}
      </td>
    </tr>
  )
}
