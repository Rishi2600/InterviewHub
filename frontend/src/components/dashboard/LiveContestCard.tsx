import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/common/UserAvatar'
import { useLeaderboardSocket } from '@/hooks/useLeaderboardSocket'
import { getContestResults } from '@/lib/endpoints'
import type { Contest } from '@/types'

/** Top five of a running contest, updated live. */
export function LiveContestCard({ contest }: { contest: Contest }) {
  const board = useLeaderboardSocket(contest._id)
  // The live board carries user ids only; the entry roster has the names.
  const entries = useQuery({
    queryKey: ['contest-entries', contest._id],
    queryFn: () => getContestResults(contest._id),
  })
  const names = useMemo(
    () => Object.fromEntries((entries.data ?? []).map((e) => [e.userId, e.username])),
    [entries.data],
  )
  const top = board.rows.slice(0, 5)
  const best = Math.max(1, ...top.map((r) => r.score))
  const total = entries.data?.length ?? 0

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="min-w-0 truncate font-heading">{contest.title}</CardTitle>
        <CardDescription>
          Live leaderboard{total > 0 ? `, top ${Math.min(5, total)} of ${total}` : ''}
        </CardDescription>
        <CardAction>
          <Badge>Active</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        {!board.hasLoaded ? (
          <div className="grid gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : top.length === 0 ? (
          <p className="text-sm text-muted-foreground">No one has joined yet.</p>
        ) : (
          <ol className="grid gap-3">
            {top.map((row) => {
              const name = names[row.userId] ?? 'Entrant'
              return (
                <li key={row.userId} className="grid grid-cols-[1rem_1.5rem_1fr_2rem] items-center gap-2.5">
                  <span className="font-mono text-xs text-muted-foreground">{row.rank}</span>
                  <UserAvatar name={name} size="sm" />
                  <div className="grid min-w-0 gap-1.5">
                    <span className="truncate text-sm">{name}</span>
                    <Progress value={(row.score / best) * 100} className="h-1.5" />
                  </div>
                  <span className="text-right font-heading font-semibold">{row.score}</span>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
      <CardFooter className="mt-auto justify-between text-sm">
        <span className="text-muted-foreground">Updated live</span>
        <Button variant="link" className="h-auto p-0 text-brand" asChild>
          <Link to={`/contests/${contest._id}`}>Open contest</Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
