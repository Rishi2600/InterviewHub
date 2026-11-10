import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { AlarmClock, Award, Check, CircleCheck, CircleDashed, CircleX, Ellipsis, Info, Lightbulb, Loader2, Users, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar } from '@/components/common/UserAvatar'
import { ErrorState } from '@/components/common/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { ProfileLink } from '@/components/score/ProfileLink'
import { Panel, PhaseBadge, PromptText, RATED_AT, RatedBadge, Stat } from '@/components/contest/bits'
import { useAuth } from '@/hooks/useAuth'
import { useContestSocket } from '@/hooks/useContestSocket'
import { getContestResults, getLeaderboard } from '@/lib/endpoints'
import { errorMessage, errorStatus } from '@/lib/api'
import { clock, shortDay, timeUsed } from '@/lib/contest-time'
import { cn } from '@/lib/utils'
import { CodeReview } from '@/components/contest/CodeReview'
import type { BoardRow, CodeResultQuestion, ContestResults as Results, ResultQuestion } from '@/types'

const TOP = 10

/** Final standings, your own result and every answer, once a contest is scored. */
export function ContestResults() {
  const { id = '' } = useParams()
  const results = useQuery({
    queryKey: ['contest', id, 'results'],
    queryFn: () => getContestResults(id),
    retry: (count, err) => errorStatus(err) !== 409 && count < 1,
    // Still being scored: look again shortly (the socket usually wins).
    refetchInterval: (q) => (errorStatus(q.state.error) === 409 ? 10_000 : false),
  })
  useContestSocket(id, errorStatus(results.error) === 409)

  if (results.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }
  if (results.isError) {
    if (errorStatus(results.error) === 409) {
      return (
        <div className="mx-auto grid max-w-md justify-items-center gap-4 py-16 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-primary/10 text-brand">
            <Loader2 className="size-6 animate-spin" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold">Results are not out yet</h1>
          <p className="text-muted-foreground">
            They open about a minute after the contest ends. This page updates by itself.
          </p>
          <Button variant="outline" asChild>
            <Link to={`/contests/${id}`}>Back to contest page</Link>
          </Button>
        </div>
      )
    }
    return <ErrorState title="Could not load results" message={errorMessage(results.error)} onRetry={() => void results.refetch()} />
  }

  const r = results.data
  const host = r.questions.some((q) => q.correctCount !== undefined)
  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-1.5">
            <Link to="/contests" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              Contests
            </Link>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <Link to={`/contests/${id}`} className="hidden truncate text-muted-foreground hover:text-foreground sm:inline">
              {r.contest.title}
            </Link>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <span className="font-medium">Results</span>
          </span>
        }
      />
      <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-6">
        <div className="grid gap-2">
          <div className="flex flex-wrap gap-1.5">
            <PhaseBadge phase="ended" />
            <RatedBadge rated={r.contest.rated} />
          </div>
          <h1 className="text-3xl font-semibold">{r.contest.title}</h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <UserAvatar name={r.contest.hostName} size="sm" className="size-5 text-[9px]" />
            {r.contest.hostName}
            <span>·</span>
            Ended {shortDay(r.contest.endAt)}, {clock(r.contest.endAt)}
            <span>·</span>
            {r.contest.questionCount} questions, {r.contest.totalPoints} points
          </p>
        </div>

        {r.me && <ResultStrip results={r} />}

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="lg:sticky lg:top-24">
            <Leaderboard results={r} />
          </div>
          {r.contest.format === 'code' ? (
            <CodeReview questions={r.questions as CodeResultQuestion[]} entered={Boolean(r.me)} host={host} />
          ) : (
            <Review results={r} host={host} />
          )}
        </div>
      </div>
    </>
  )
}

function ResultStrip({ results: r }: { results: Results }) {
  const me = r.me!
  const rated = r.contest.rated
  return (
    <section className="grid gap-5 rounded-xl bg-primary/10 p-5 sm:p-6 lg:grid-cols-[auto_1fr_auto] lg:items-center lg:gap-10">
      <div className="flex items-baseline gap-2">
        <span className="font-heading text-5xl font-semibold text-brand tabular-nums">#{me.rank}</span>
        <span className="text-muted-foreground">of {r.contest.starters} starters</span>
      </div>
      <dl className="grid grid-cols-3 gap-4">
        <Stat
          label="Score"
          value={
            <>
              {me.score}
              <span className="text-sm font-normal text-muted-foreground">/{r.contest.totalPoints}</span>
            </>
          }
          className="py-0 [&_dd]:text-2xl"
        />
        <Stat
          label={r.contest.format === 'code' ? 'Last submit' : 'Time used'}
          value={timeUsed(me.timeUsedMs)}
          className="py-0 [&_dd]:text-2xl"
        />
        <Stat label="Ahead of" value={`${Math.round(me.percentile * 100)}%`} className="py-0 [&_dd]:text-2xl" />
      </dl>
      <p className="flex max-w-xs gap-2 text-sm">
        {rated ? (
          <Award className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
        ) : (
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span>
          {rated
            ? `Counts toward your score: ${r.contest.starters} people started, and ${RATED_AT} are needed.`
            : `Doesn't count toward your score: only ${r.contest.starters} started, and ${RATED_AT} are needed.`}
        </span>
      </p>
    </section>
  )
}

function BoardTableRow({ row, me }: { row: BoardRow; me: boolean }) {
  return (
    <tr className={me ? 'bg-primary/10' : 'border-t'}>
      <td
        className={cn(
          'w-12 py-2.5 pr-2 pl-5 font-heading font-semibold tabular-nums',
          me || row.rank <= 3 ? 'text-brand' : 'text-muted-foreground',
        )}
      >
        {row.rank}
      </td>
      <td className="py-2.5 pr-2">
        <span className="flex min-w-0 items-center gap-2">
          <UserAvatar name={row.username} size="sm" />
          <ProfileLink userId={row.userId} className={cn('truncate', me ? 'font-semibold' : 'font-medium')}>
            {row.username}
            {me && <span className="font-normal text-muted-foreground"> (you)</span>}
          </ProfileLink>
        </span>
      </td>
      <td className="py-2.5 pr-3 text-right text-muted-foreground tabular-nums">
        {timeUsed(row.timeUsedMs)}
        {row.autoSubmitted && (
          <span className="ml-1 inline-flex align-middle" title="Submitted automatically at the end">
            <AlarmClock className="size-3.5" aria-label="Submitted automatically" />
          </span>
        )}
      </td>
      <td className="py-2.5 pr-5 text-right font-heading font-semibold tabular-nums">{row.score}</td>
    </tr>
  )
}

function Leaderboard({ results: r }: { results: Results }) {
  const { user } = useAuth()
  const [all, setAll] = useState(false)
  const full = useInfiniteQuery({
    queryKey: ['contest', r.contest._id, 'leaderboard'],
    queryFn: ({ pageParam }) => getLeaderboard(r.contest._id, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: all,
  })
  const rows = all ? (full.data?.pages.flatMap((p) => p.items) ?? r.top) : r.top
  const isMe = (row: BoardRow) => row.userId === user?.id
  const meOutside = !all && r.me && r.me.rank > TOP && !r.top.some(isMe)
  const ties = rows.some((row, i) => i > 0 && rows[i - 1].rank === row.rank)
  // A code contest ranks ties by the last submission that scored, and has
  // no answers to hand in at the end.
  const code = r.contest.format === 'code'
  const anyAuto = !code && rows.some((row) => row.autoSubmitted)

  return (
    <Panel
      title="Leaderboard"
      extra={<span className="ml-auto text-xs text-muted-foreground tabular-nums">{r.contest.starters} starters</span>}
    >
      {rows.length === 0 ? (
        <p className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
          <Users className="size-4" aria-hidden />
          Nobody started this contest.
        </p>
      ) : (
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-12" />
            <col />
            <col className="w-24" />
            <col className="w-16" />
          </colgroup>
          <thead className="text-left text-xs text-muted-foreground">
            <tr>
              <th className="py-2 pl-5 font-medium">#</th>
              <th className="py-2 font-medium">Entrant</th>
              <th className="py-2 pr-3 text-right font-medium">{code ? 'Last submit' : 'Time'}</th>
              <th className="py-2 pr-5 text-right font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <BoardTableRow key={row._id} row={row} me={isMe(row)} />
            ))}
            {meOutside && user && (
              <>
                <tr className="border-t">
                  <td colSpan={4} className="py-1 text-center text-muted-foreground">
                    <Ellipsis className="mx-auto size-4" aria-hidden />
                  </td>
                </tr>
                <BoardTableRow
                  row={{
                    _id: 'me',
                    userId: user.id,
                    username: user.username,
                    rank: r.me!.rank,
                    score: r.me!.score,
                    timeUsedMs: r.me!.timeUsedMs,
                    autoSubmitted: r.me!.autoSubmitted,
                  }}
                  me
                />
              </>
            )}
          </tbody>
        </table>
      )}
      <div className="grid gap-2 border-t px-5 py-3 text-xs text-muted-foreground empty:hidden">
        {ties && (
          <p>
            {code
              ? 'Ties on score go to whoever made their last scoring submission sooner. Exact ties share a rank.'
              : 'Ties on score go to whoever used less time. Exact ties share a rank.'}
          </p>
        )}
        {anyAuto && (
          <p className="flex items-center gap-1.5">
            <AlarmClock className="size-3.5" aria-hidden />
            Didn&apos;t submit: saved answers went in at the end.
          </p>
        )}
        {!all && r.contest.starters > TOP && (
          <button type="button" className="justify-self-start font-medium text-brand" onClick={() => setAll(true)}>
            Show all {r.contest.starters}
          </button>
        )}
        {all && full.hasNextPage && (
          <button
            type="button"
            className="justify-self-start font-medium text-brand"
            onClick={() => void full.fetchNextPage()}
            disabled={full.isFetchingNextPage}
          >
            {full.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </Panel>
  )
}

type Filter = 'all' | 'correct' | 'wrong' | 'unanswered'

const statusOf = (q: ResultQuestion): Exclude<Filter, 'all'> =>
  !q.picked || q.picked.length === 0 ? 'unanswered' : q.earned > 0 ? 'correct' : 'wrong'

const STATUS = {
  correct: { icon: CircleCheck, tone: 'text-brand', label: 'Correct' },
  wrong: { icon: CircleX, tone: 'text-danger', label: 'Wrong' },
  unanswered: { icon: CircleDashed, tone: 'text-muted-foreground', label: 'Not answered' },
} as const

const PREVIEW = 8

function Review({ results, host }: { results: Results; host: boolean }) {
  const r = { ...results, questions: results.questions as ResultQuestion[] }
  const entered = Boolean(r.me)
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState(false)
  const counts = {
    all: r.questions.length,
    correct: r.questions.filter((q) => statusOf(q) === 'correct').length,
    wrong: r.questions.filter((q) => statusOf(q) === 'wrong').length,
    unanswered: r.questions.filter((q) => statusOf(q) === 'unanswered').length,
  }
  const matching = r.questions.filter((q) => !entered || filter === 'all' || statusOf(q) === filter)
  const shown = expanded ? matching : matching.slice(0, PREVIEW)

  return (
    <Panel title={entered ? 'Your answers' : host ? 'Questions and how entrants did' : 'Questions and answers'}>
      {entered && (
        <div className="flex gap-1 overflow-x-auto border-b px-5 py-2.5">
          {(
            [
              ['all', 'All'],
              ['correct', 'Correct'],
              ['wrong', 'Wrong'],
              ['unanswered', 'Unanswered'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium',
                k === filter ? 'bg-secondary' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {label}
              <span className="text-xs text-muted-foreground tabular-nums">{counts[k]}</span>
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">No questions here.</p>
      ) : (
        <ol>
          {shown.map((q) => (
            <ReviewItem key={q._id} q={q} entered={entered} starters={r.contest.starters} />
          ))}
        </ol>
      )}
      {!expanded && matching.length > PREVIEW && (
        <div className="border-t px-5 py-3 text-center">
          <Button variant="ghost" size="sm" className="text-brand" onClick={() => setExpanded(true)}>
            Show all {matching.length}
          </Button>
        </div>
      )}
    </Panel>
  )
}

function ReviewItem({ q, entered, starters }: { q: ResultQuestion; entered: boolean; starters: number }) {
  const status = STATUS[statusOf(q)]
  const correct = new Set(q.correctOptionIds)
  const picked = new Set(q.picked ?? [])
  return (
    <li className="grid gap-3 border-t p-5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {entered && (
          <>
            <status.icon className={cn('size-4', status.tone)} aria-hidden />
            <span className={cn('font-medium whitespace-nowrap', status.tone)}>{status.label}</span>
          </>
        )}
        <span className="text-muted-foreground">
          Question {q.number} · {q.kind === 'single' ? 'Single choice' : 'Multiple choice'}
        </span>
        <span className="ml-auto font-heading font-semibold tabular-nums">
          {entered ? q.earned : q.points}
          {entered && <span className="text-xs font-normal text-muted-foreground">/{q.points}</span>}
          {!entered && <span className="text-xs font-normal text-muted-foreground"> pt{q.points > 1 ? 's' : ''}</span>}
        </span>
      </div>
      <PromptText text={q.prompt} className="font-medium" />
      {q.correctCount !== undefined && (
        <div className="grid gap-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              {q.correctCount} of {starters} got it right
            </span>
            <span>{q.answeredCount} answered</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${starters ? (q.correctCount / starters) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
      <ul className="grid gap-1.5">
        {q.options.map((o) => {
          const isCorrect = correct.has(o.id)
          const isPicked = picked.has(o.id)
          return (
            <li
              key={o.id}
              className={cn(
                'flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border px-3 py-2.5 text-sm',
                isCorrect ? 'border-primary/50 bg-primary/5' : isPicked ? 'border-danger/40 bg-danger/5' : '',
              )}
            >
              {isCorrect ? (
                <Check className="size-4 text-brand" aria-label="Correct answer" />
              ) : isPicked ? (
                <X className="size-4 text-danger" aria-label="Wrong pick" />
              ) : (
                <span className="size-4" />
              )}
              <span className="min-w-0 flex-1 whitespace-pre-line">{o.text}</span>
              {(isPicked || isCorrect) && (
                <span className="flex w-full gap-1.5 pl-7 sm:w-auto sm:shrink-0 sm:pl-0">
                  {isPicked && <span className="rounded bg-secondary px-1.5 py-0.5 text-[11px] font-medium">Your pick</span>}
                  {isCorrect && <span className="text-[11px] font-medium text-brand">Correct answer</span>}
                </span>
              )}
            </li>
          )
        })}
      </ul>
      {q.explanation && (
        <div className="flex gap-2 rounded-lg bg-muted p-3 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
          <span className="whitespace-pre-line text-muted-foreground">{q.explanation}</span>
        </div>
      )}
    </li>
  )
}
