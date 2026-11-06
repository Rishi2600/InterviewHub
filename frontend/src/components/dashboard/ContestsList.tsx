import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Trophy } from 'lucide-react'
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PhaseBadge } from '@/components/contest/bits'
import { ShowMore } from '@/components/common/ShowMore'
import type { MoreControl } from '@/hooks/usePagedList'
import { phaseOfContest } from '@/lib/contest-phase'
import { clock, shortDay } from '@/lib/contest-time'
import type { Contest, ContestPhase } from '@/types'

function note(c: Contest, phase: ContestPhase): string {
  switch (phase) {
    case 'draft':
      return 'Draft, only you can see it'
    case 'upcoming':
      return c.startAt ? `Starts ${shortDay(c.startAt)}, ${clock(c.startAt)}` : 'Not scheduled'
    case 'live':
      return `Ends at ${clock(c.endAt!)}`
    case 'pending':
      return 'Scoring now'
    case 'cancelled':
      return 'Cancelled'
    default:
      return `Ended ${shortDay(c.endAt!)}`
  }
}

/** Where each of your contests goes: the editor for drafts, results once
 *  they are out, otherwise the contest page. */
function href(c: Contest, phase: ContestPhase): string {
  if (phase === 'draft') return `/contests/${c._id}/edit`
  if (phase === 'ended') return `/contests/${c._id}/results`
  return `/contests/${c._id}`
}

export function ContestsList({
  contests,
  canHost,
  more,
}: {
  contests: Contest[]
  canHost: boolean
  more?: MoreControl
}) {
  // Read once per render pass; these labels do not need to tick.
  const [now] = useState(() => Date.now())
  return (
    <Card className="min-w-0 gap-2">
      <CardHeader>
        <CardTitle className="font-heading">Your contests</CardTitle>
        <CardDescription>Contests you host or have entered.</CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/contests">Browse</Link>
          </Button>
        </CardAction>
      </CardHeader>
      {contests.length === 0 ? (
        <p className="px-6 pb-2 text-sm text-muted-foreground">
          {canHost ? 'No contests yet. Create one, or join one from the contests page.' : 'Contests you join will show here.'}
        </p>
      ) : (
        <ul className="px-2">
          {contests.map((c) => {
            const phase = phaseOfContest(c, now)
            return (
              <li key={c._id}>
                <Link to={href(c, phase)} className="flex items-center gap-3 rounded-md px-4 py-2.5 hover:bg-muted/50">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md border text-muted-foreground">
                    <Trophy className="size-4" aria-hidden />
                  </span>
                  <span className="grid min-w-0 flex-1 leading-tight">
                    <span className="truncate text-sm font-medium">{c.title}</span>
                    <span className="truncate text-xs text-muted-foreground">{note(c, phase)}</span>
                  </span>
                  <PhaseBadge phase={phase} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <ShowMore more={more} className="flex justify-center px-2" />
    </Card>
  )
}
