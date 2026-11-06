import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { Contest } from '@/types'
import { ShowMore } from '@/components/common/ShowMore'
import type { MoreControl } from '@/hooks/usePagedList'

const NOTE = { draft: 'Not started', active: 'Scoring now', ended: 'Ended' } as const

export function ContestsList({
  contests,
  canHost,
  more,
}: {
  contests: Contest[]
  canHost: boolean
  more?: MoreControl
}) {
  return (
    <Card className="min-w-0 gap-2">
      <CardHeader>
        <CardTitle className="font-heading">Your contests</CardTitle>
        <CardDescription>Contests you run or have entered.</CardDescription>
      </CardHeader>
      {contests.length === 0 ? (
        <p className="px-6 pb-2 text-sm text-muted-foreground">
          {canHost ? 'No contests yet. Create one to score candidates live.' : 'Contests you join will show here.'}
        </p>
      ) : (
        <ul className="px-2">
          {contests.map((c) => (
            <li key={c._id}>
              <Link
                to={`/contests/${c._id}`}
                className="flex items-center gap-3 rounded-md px-4 py-2.5 hover:bg-muted/50"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-md border text-muted-foreground">
                  <Trophy className="size-4" aria-hidden />
                </span>
                <span className="grid min-w-0 flex-1 leading-tight">
                  <span className="truncate text-sm font-medium">{c.title}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {NOTE[c.state]}
                  </span>
                </span>
                <StatusBadge state={c.state} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <ShowMore more={more} className="flex justify-center px-2" />
    </Card>
  )
}
