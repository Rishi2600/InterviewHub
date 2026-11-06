import { Link } from 'react-router-dom'
import { ArrowRight, EyeOff, Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { PhaseBadge, RatedMeter } from '@/components/contest/bits'
import { useContestSocket } from '@/hooks/useContestSocket'
import { useNow } from '@/hooks/useNow'
import { countdown } from '@/lib/contest-time'
import type { ContestCard } from '@/types'

/** A running contest you host or entered: time left and live counts.
 *  Scores stay hidden until the end, so there is no board here. */
export function LiveContestCard({ contest }: { contest: ContestCard }) {
  const live = useContestSocket(contest._id)
  const now = useNow(1000)
  const c = { ...contest, ...(live ?? {}) }
  const hosting = contest.viewer?.hosting
  const stats = [
    ['Entered', c.entrantCount],
    ['Started', c.startedCount],
    ['Submitted', c.submittedCount],
  ] as const

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle className="min-w-0 truncate font-heading">{c.title}</CardTitle>
        <CardDescription>
          Ends in <span className="font-medium text-brand tabular-nums">{countdown(new Date(c.endAt!).getTime() - now)}</span>
        </CardDescription>
        <CardAction>
          <PhaseBadge phase="live" />
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-3 divide-x rounded-lg border text-center">
          {stats.map(([k, v]) => (
            <div key={k} className="py-2">
              <dt className="text-xs text-muted-foreground">{k}</dt>
              <dd className="font-heading font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <RatedMeter n={c.startedCount} />
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <EyeOff className="size-3.5" aria-hidden />
          Scores stay hidden until the end.
        </p>
      </CardContent>
      <CardFooter>
        <Button size="sm" variant={hosting ? 'outline' : 'default'} className="w-full" asChild>
          <Link to={hosting ? `/contests/${c._id}` : `/contests/${c._id}/play`}>
            {hosting ? <Settings2 aria-hidden /> : <ArrowRight aria-hidden />}
            {hosting ? 'Manage' : 'Continue'}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  )
}
