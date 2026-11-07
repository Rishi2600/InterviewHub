import { ArrowDownRight, ArrowUpRight, Hourglass } from 'lucide-react'
import { useUserScore } from '@/hooks/useUserScore'
import { errorMessage } from '@/lib/api'
import { formatDay } from '@/lib/score'
import { ErrorState } from '@/components/common/States'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { UserScore } from '@/types'
import { BadgeShelf } from './BadgeHex'
import { ContestHistory } from './ContestHistory'
import { ContributionGraph } from './ContributionGraph'
import { Panel } from './Panel'
import { TrendLine } from './TrendLine'

/**
 * Score tiles, badges, the activity graph and contest history: what the
 * candidate sees on their profile and interviewers see on theirs.
 */
export function ScoreSection({ userId, isSelf }: { userId: string; isSelf: boolean }) {
  const score = useUserScore(userId)
  if (score.isPending) return <Skeleton className="h-64 w-full rounded-xl" />
  if (score.isError) {
    return <ErrorState title="Could not load the score" message={errorMessage(score.error)} onRetry={() => void score.refetch()} />
  }
  const s = score.data
  const earned = s.badges.filter((b) => b.count > 0).length

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:grid-cols-2 lg:grid-cols-[minmax(0,5fr)_minmax(0,3fr)_minmax(0,4fr)]">
        <section className="grid gap-4 rounded-xl border border-primary/30 bg-primary/10 p-5 md:col-span-2 lg:col-span-1">
          <ScoreFigure s={s} isSelf={isSelf} />
          {s.score !== null && <TrendLine history={s.history} />}
        </section>
        <CompletionTile s={s} />
        <section className="rounded-xl border bg-card p-5">
          <dl className="grid h-full grid-cols-2 content-center gap-4">
            <Stat label="Rated contests" value={s.ratedCount} />
            <Stat label="Contests entered" value={s.enteredCount} />
            <Stat
              label="Last active"
              value={s.lastActiveAt ? formatDay(s.lastActiveAt, { day: 'numeric', month: 'short' }) : '–'}
              note={s.lastActiveAt ? formatDay(s.lastActiveAt, { year: 'numeric' }) : undefined}
            />
          </dl>
        </section>
      </div>

      <Panel title="Badges" extra={`${earned} earned`}>
        <div className="p-5">
          <BadgeShelf badges={s.badges} />
        </div>
      </Panel>

      <Panel title="Activity">
        <div className="p-5">
          <ContributionGraph userId={userId} />
        </div>
      </Panel>

      <ContestHistory userId={userId} />
    </div>
  )
}

function ScoreFigure({ s, isSelf }: { s: UserScore; isSelf: boolean }) {
  if (s.score === null) {
    return (
      <div className="grid gap-2">
        <span className="text-xs font-medium text-muted-foreground">Contest score</span>
        <span className="font-heading text-3xl font-semibold">No score yet</span>
        <p className="max-w-sm text-sm text-muted-foreground">
          Appears after {isSelf ? 'your' : 'their'} first rated contest, one with 10 or more starters. Unrated contests still
          show in the activity graph.
        </p>
        <FormulaLine s={s} />
      </div>
    )
  }
  const left = 3 - s.ratedCount
  const n = s.history.length
  const change = n > 1 ? s.history[n - 1].score - s.history[n - 2].score : null
  return (
    <div className="grid gap-2">
      <span className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
        Contest score
        {s.provisional && (
          <span className="inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5">
            <Hourglass className="size-3" aria-hidden />
            Provisional · {left} more rated contest{left === 1 ? '' : 's'}
          </span>
        )}
      </span>
      <div className="flex items-baseline gap-2">
        <span className={cn('font-heading text-6xl font-semibold tabular-nums', s.provisional ? 'text-muted-foreground' : 'text-brand')}>
          {s.score.toFixed(1)}
        </span>
        <span className="text-muted-foreground">/ 10</span>
        {change !== null && Math.abs(change) >= 0.05 && (
          <span className={cn('inline-flex items-center gap-0.5 text-sm tabular-nums', change < 0 ? 'text-danger' : 'text-brand')}>
            {change < 0 ? <ArrowDownRight className="size-3.5" aria-hidden /> : <ArrowUpRight className="size-3.5" aria-hidden />}
            <span className="sr-only">{change < 0 ? 'down' : 'up'}</span>
            {Math.abs(change).toFixed(1)}
          </span>
        )}
      </div>
      {s.provisional && <FormulaLine s={s} />}
    </div>
  )
}

/** How the score is worked out, with the candidate's own numbers once there are some.
 *  Shown only until the score is settled. */
function FormulaLine({ s }: { s: UserScore }) {
  const f = s.formula
  const cls = 'font-mono text-[11px] leading-relaxed text-muted-foreground/80'
  if (!f || s.score === null) {
    return (
      <p className={cls}>
        score = 10 × (Σ w·p + 1) ÷ (Σ w + 2) × (0.9 + 0.1 × completion)
        <br />
        over the last 10 rated contests · p = share of starters beaten · w = min(1, starters ÷ 50)
      </p>
    )
  }
  return (
    <p className={cls}>
      10 × ({f.weightedSum.toFixed(2)} + 1) ÷ ({f.weightTotal.toFixed(2)} + 2) × {f.multiplier.toFixed(2)} = {s.score.toFixed(2)}
      <br />
      last {f.window} rated contest{f.window === 1 ? '' : 's'} · p = share of starters beaten · w = min(1, starters ÷ 50) · ×
      {f.multiplier.toFixed(2)} for {f.submitted} of {f.window} submitted
    </p>
  )
}

function CompletionTile({ s }: { s: UserScore }) {
  const f = s.formula
  const share = f ? f.submitted / f.window : 0
  const r = 26
  const c = 2 * Math.PI * r
  return (
    <section className="flex items-center gap-4 rounded-xl border bg-card p-5">
      <svg viewBox="0 0 64 64" className="size-16 shrink-0 -rotate-90" aria-hidden>
        <circle cx={32} cy={32} r={r} fill="none" stroke="var(--muted)" strokeWidth={7} />
        {f && <circle cx={32} cy={32} r={r} fill="none" stroke="var(--primary)" strokeWidth={7} strokeLinecap="round" strokeDasharray={`${c * share} ${c}`} />}
      </svg>
      <dl>
        <Stat
          label="Completion"
          value={f ? `${Math.round(share * 100)}%` : '–'}
          note={f ? `${f.submitted} of last ${f.window} rated submitted` : 'no rated contests yet'}
          big
        />
      </dl>
    </section>
  )
}

function Stat({ label, value, note, big }: { label: string; value: string | number; note?: string; big?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('font-heading font-semibold tabular-nums', big ? 'text-3xl' : 'text-2xl')}>{value}</dd>
      {note && <dd className="text-xs text-muted-foreground">{note}</dd>}
    </div>
  )
}
