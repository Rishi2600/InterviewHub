import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  Award,
  Ban,
  CircleCheck,
  Clock,
  EyeOff,
  Info,
  Link2,
  ListChecks,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Save,
  Trophy,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { LiveDot } from '@/components/common/LiveDot'
import { UserAvatar } from '@/components/common/UserAvatar'
import { ErrorState } from '@/components/common/States'
import { PageHeader } from '@/components/layout/PageHeader'
import {
  HostingBadge,
  JoinedBadge,
  Panel,
  PhaseBadge,
  RATED_AT,
  RatedBadge,
  RatedMeter,
  Stat,
} from '@/components/contest/bits'
import { useContestSocket } from '@/hooks/useContestSocket'
import { useCopy } from '@/hooks/useCopy'
import { useNow } from '@/hooks/useNow'
import { cancelContest, getContestDetails, joinContest, leaveContest } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { livePhase } from '@/lib/contest-phase'
import { clock, countdown, length, longDay, shortDay, timeUsed, zoneName } from '@/lib/contest-time'
import type { ContestDetails as Details, ContestPhase } from '@/types'

/** One contest, in any phase, for any signed-in user. */
export function ContestDetails() {
  const { id = '' } = useParams()
  const now = useNow(1000)
  const details = useQuery({
    queryKey: ['contest', id, 'details'],
    queryFn: () => getContestDetails(id),
    // Results can land while the page is open; check now and then too, in
    // case the socket missed it.
    refetchInterval: (q) => (q.state.data && livePhase(q.state.data, Date.now()) === 'pending' ? 15_000 : false),
  })
  const counts = useContestSocket(id, details.data?.status === 'published')

  if (details.isPending) {
    return (
      <div className="mx-auto grid w-full max-w-6xl gap-6">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }
  if (details.isError) {
    return <ErrorState title="Contest not found" message={errorMessage(details.error)} onRetry={() => void details.refetch()} />
  }

  const c = { ...details.data, ...(counts ?? {}) }
  const phase = livePhase(c, now)
  const v = c.viewer

  return (
    <>
      <PageHeader
        title={
          <span className="flex min-w-0 items-center gap-1.5">
            <Link to="/contests" className="hidden text-muted-foreground hover:text-foreground sm:inline">
              Contests
            </Link>
            <span className="hidden text-muted-foreground sm:inline">/</span>
            <span className="truncate font-medium">{c.title}</span>
          </span>
        }
      >
        {v.canManage && (phase === 'upcoming' || phase === 'draft') && (
          <Button variant="outline" size="sm" asChild>
            <Link to={`/contests/${id}/edit`}>
              <Pencil aria-hidden />
              Edit
            </Link>
          </Button>
        )}
      </PageHeader>

      <div className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] gap-6">
        {phase === 'cancelled' && (
          <div className="flex gap-3 rounded-xl border border-danger/40 bg-danger/5 p-4 text-sm">
            <Ban className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
            <div>
              <p className="font-medium">Cancelled by the host</p>
              <p className="text-muted-foreground">This contest will not run. Nothing counts toward anyone&apos;s score.</p>
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div className="grid gap-3">
            <div className="flex flex-wrap gap-1.5">
              <PhaseBadge phase={phase} />
              {v.entry && phase !== 'cancelled' && <JoinedBadge />}
              {v.hosting && <HostingBadge />}
              {phase === 'ended' && <RatedBadge rated={c.rated} />}
            </div>
            <h1 className="text-3xl leading-tight font-semibold sm:text-4xl">{c.title}</h1>
            <p className="flex items-center gap-2 text-muted-foreground">
              <UserAvatar name={c.hostName} size="sm" />
              Hosted by <span className="text-foreground">{c.hostName}</span>
            </p>
          </div>
          <TimePanel contest={c} phase={phase} now={now} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="grid gap-6">
            {(phase === 'ended' || phase === 'pending') && <ResultsTeaser contest={c} phase={phase} />}
            <Panel title="About">
              <div className="grid gap-3 p-5 text-sm leading-relaxed whitespace-pre-line">
                {c.description || <span className="text-muted-foreground">No description.</span>}
              </div>
            </Panel>
            <Panel title="How it works">
              <ul className="grid gap-4 p-5 text-sm">
                {rules(c).map(([icon, text], i) => (
                  <li key={i} className="flex gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-brand [&_svg]:size-4">
                      {icon}
                    </span>
                    <span className="pt-1.5">{text}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
          <div className="order-first grid gap-4 lg:sticky lg:top-24 lg:order-none">
            <ActionCard contest={c} phase={phase} now={now} />
            <CountsCard contest={c} phase={phase} />
            <ScheduleCard contest={c} />
          </div>
        </div>
      </div>
    </>
  )
}

function rules(c: Details): [ReactNode, string][] {
  const end = c.endAt ? clock(c.endAt) : 'the end'
  return [
    [
      <ListChecks key="q" />,
      `${c.questionCount} questions, single and multiple choice. Multiple choice scores only when every correct option and no wrong one is picked.`,
    ],
    [<Clock key="c" />, `Everyone finishes at ${end}. Joining late gives you only the time that is left.`],
    [<Save key="s" />, 'Answers save as you pick them. You can change them until you submit or time runs out.'],
    [
      <EyeOff key="e" />,
      'No scores are shown while the contest runs. The leaderboard, correct answers and explanations open at the end.',
    ],
    [<Award key="a" />, `Counts toward your score if ${RATED_AT} or more people start it.`],
  ]
}

function TimePanel({ contest: c, phase, now }: { contest: Details; phase: ContestPhase; now: number }) {
  if (!c.startAt || !c.endAt) {
    return (
      <div className="grid gap-1 rounded-xl border border-dashed p-5 text-sm text-muted-foreground">No start time yet.</div>
    )
  }
  const range = (
    <div>
      <div className="text-xs text-muted-foreground">{longDay(c.startAt)}</div>
      <div className="font-heading text-2xl font-semibold tabular-nums">
        {clock(c.startAt)} – {clock(c.endAt)}
      </div>
    </div>
  )
  if (phase === 'cancelled') {
    return (
      <div className="grid gap-1 rounded-xl border border-dashed p-5">
        <div className="text-xs text-muted-foreground">Was scheduled for {longDay(c.startAt)}</div>
        <div className="font-heading text-2xl font-semibold text-muted-foreground tabular-nums line-through">
          {clock(c.startAt)} – {clock(c.endAt)}
        </div>
      </div>
    )
  }
  const start = new Date(c.startAt).getTime()
  const end = new Date(c.endAt).getTime()
  const right =
    phase === 'upcoming' || phase === 'draft' ? (
      <Right label="Starts in" big>
        {countdown(start - now)}
      </Right>
    ) : phase === 'live' ? (
      <Right label="Ends in" big>
        {countdown(end - now)}
      </Right>
    ) : phase === 'pending' ? (
      <Right label="Ended">
        <span className="flex items-center gap-2 text-brand">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          Scoring
        </span>
      </Right>
    ) : (
      <Right label="Ended">
        {shortDay(c.endAt)} {clock(c.endAt)}
      </Right>
    )
  return (
    <div className="grid gap-3 rounded-xl bg-primary/10 p-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {range}
        {right}
      </div>
      {phase === 'live' && (
        <div className="h-1.5 overflow-hidden rounded-full bg-card">
          <div className="h-full rounded-full bg-primary" style={{ width: `${((now - start) / (end - start)) * 100}%` }} />
        </div>
      )}
    </div>
  )
}

function Right({ label, big, children }: { label: string; big?: boolean; children: ReactNode }) {
  return (
    <div className="ml-auto text-right">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          big
            ? 'font-heading text-3xl font-semibold text-brand tabular-nums'
            : 'font-heading text-lg font-semibold tabular-nums'
        }
      >
        {children}
      </div>
    </div>
  )
}

function Note({ icon, children, strong }: { icon: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <p className={`flex gap-2 text-sm ${strong ? 'text-foreground' : 'text-muted-foreground'}`}>
      <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>
      <span>{children}</span>
    </p>
  )
}

function ActionCard({ contest: c, phase, now }: { contest: Details; phase: ContestPhase; now: number }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const copy = useCopy()
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['contest', c._id] })
    void queryClient.invalidateQueries({ queryKey: ['contests'] })
  }
  const join = useMutation({
    mutationFn: () => joinContest(c._id),
    onSuccess: () => {
      refresh()
      if (phase === 'live') navigate(`/contests/${c._id}/play`)
      else toast.success("You're in")
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not join')),
  })
  const leave = useMutation({
    mutationFn: () => leaveContest(c._id),
    onSuccess: () => {
      refresh()
      toast.success('You left the contest')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not leave')),
  })
  const cancel = useMutation({
    mutationFn: () => cancelContest(c._id),
    onSuccess: () => {
      refresh()
      toast.success('Contest cancelled')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not cancel')),
  })

  const wrap = (body: ReactNode) => <Panel className="grid gap-3 p-5">{body}</Panel>
  const v = c.viewer
  const entry = v.entry
  const resultsButton = (label: string) => (
    <Button className="w-full" asChild>
      <Link to={`/contests/${c._id}/results`}>
        <Trophy aria-hidden />
        {label}
      </Link>
    </Button>
  )

  if (phase === 'cancelled') {
    return wrap(<Note icon={<Ban />}>The host cancelled this contest. Nothing to join.</Note>)
  }

  if (v.canManage) {
    const cancelButton = (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="w-full border-danger/40 text-danger hover:bg-danger/10" disabled={cancel.isPending}>
            <Ban aria-hidden />
            Cancel contest
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this contest?</AlertDialogTitle>
            <AlertDialogDescription>
              {c.entrantCount === 0
                ? 'Nobody has joined, so your free contest for this month comes back.'
                : `${c.entrantCount} ${c.entrantCount === 1 ? 'person has' : 'people have'} joined, so your free contest for this month does not come back.`}{' '}
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancel.mutate()}>Cancel contest</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )
    const admin = !v.hosting
    if (phase === 'draft' || phase === 'upcoming') {
      return wrap(
        <>
          <Button className="w-full" asChild>
            <Link to={`/contests/${c._id}/edit`}>
              <Pencil aria-hidden />
              Edit contest
            </Link>
          </Button>
          {phase === 'upcoming' && (
            <>
              <Button variant="outline" className="w-full" onClick={() => void copy(window.location.href, 'Link copied')}>
                <Link2 aria-hidden />
                Copy link
              </Button>
              <div className="border-t pt-3">{cancelButton}</div>
            </>
          )}
        </>,
      )
    }
    if (phase === 'live') {
      return wrap(
        <>
          <Note icon={<Lock />}>Running now. Questions and times are locked until it ends.</Note>
          <Button variant="outline" className="w-full" asChild>
            <Link to={`/contests/${c._id}/edit`}>
              <ListChecks aria-hidden />
              View questions
            </Link>
          </Button>
          {admin && cancelButton}
        </>,
      )
    }
    if (phase === 'pending') {
      return wrap(<Note icon={<Loader2 className="animate-spin" />}>Results are being worked out. This takes about a minute.</Note>)
    }
    return wrap(resultsButton('View results'))
  }

  if (phase === 'upcoming') {
    return entry
      ? wrap(
          <>
            <Note icon={<CircleCheck className="text-brand" />} strong>
              You&apos;re in. The workspace opens at {clock(c.startAt!)}.
            </Note>
            <Button variant="outline" className="w-full" disabled>
              Open workspace
            </Button>
            <Button variant="ghost" size="sm" className="justify-self-center text-muted-foreground" onClick={() => leave.mutate()} disabled={leave.isPending}>
              Leave contest
            </Button>
          </>,
        )
      : wrap(
          <>
            <Button className="w-full" onClick={() => join.mutate()} disabled={join.isPending || full(c)}>
              {join.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
              {full(c) ? 'Contest is full' : 'Join contest'}
            </Button>
            <Note icon={<Info />}>Joining is free. You can join any time before {clock(c.endAt!)}.</Note>
          </>,
        )
  }
  if (phase === 'live') {
    if (entry?.submittedAt) {
      return wrap(<Note icon={<CircleCheck className="text-brand" />} strong>Your answers are in. Results open after {clock(c.endAt!)}.</Note>)
    }
    if (entry) {
      const pct = c.questionCount ? (entry.answered / c.questionCount) * 100 : 0
      return wrap(
        <>
          <div className="grid gap-1.5">
            <div className="flex justify-between text-sm">
              <span>Your progress</span>
              <span className="font-medium tabular-nums">
                {entry.answered} of {c.questionCount} answered
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
          <Button className="w-full" asChild>
            <Link to={`/contests/${c._id}/play`}>
              <ArrowRight aria-hidden />
              {entry.startedAt ? 'Continue' : 'Start'}
            </Link>
          </Button>
        </>,
      )
    }
    const minutesLeft = Math.max(0, Math.floor((new Date(c.endAt!).getTime() - now) / 60_000))
    return wrap(
      <>
        <Button className="w-full" onClick={() => join.mutate()} disabled={join.isPending || full(c)}>
          {join.isPending && <Loader2 className="animate-spin" aria-hidden />}
          {full(c) ? 'Contest is full' : 'Join now'}
        </Button>
        <Note icon={<Clock />}>You would have {minutesLeft} minutes. Late joiners get no extra time.</Note>
      </>,
    )
  }
  if (phase === 'pending') {
    return wrap(
      <Note icon={<Loader2 className="animate-spin" />}>
        {entry ? 'Your answers are in. Results open in about a minute.' : 'Results open in about a minute.'}
      </Note>,
    )
  }
  if (entry?.rank) {
    return wrap(
      <>
        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">You placed</span>
          <span className="font-heading text-2xl font-semibold tabular-nums">
            #{entry.rank} <span className="text-base font-normal text-muted-foreground">of {c.startedCount}</span>
          </span>
        </div>
        {resultsButton('See results')}
      </>,
    )
  }
  return wrap(resultsButton('See results'))
}

const full = (c: Details) => c.capacity !== null && c.entrantCount >= c.capacity

function CountsCard({ contest: c, phase }: { contest: Details; phase: ContestPhase }) {
  const before = phase === 'upcoming' || phase === 'cancelled' || phase === 'draft'
  return (
    <Panel
      title={phase === 'live' ? 'Right now' : 'Entrants'}
      extra={phase === 'live' ? <LiveDot className="ml-1" /> : undefined}
    >
      {before ? (
        <dl className="grid grid-cols-2 divide-x text-center">
          <Stat label="Entered" value={c.entrantCount} />
          <Stat label="Spots" value={c.capacity ? Math.max(0, c.capacity - c.entrantCount) : <span className="text-base">No limit</span>} />
        </dl>
      ) : (
        <dl className="grid grid-cols-3 divide-x text-center">
          <Stat label="Entered" value={c.entrantCount} />
          <Stat label="Started" value={c.startedCount} />
          <Stat label="Submitted" value={c.submittedCount} />
        </dl>
      )}
      {phase !== 'cancelled' && phase !== 'draft' && (
        <div className="grid gap-2 border-t px-5 py-4">
          {phase === 'upcoming' && <RatedMeter n={c.entrantCount} label="entrants" />}
          {phase === 'live' && (
            <>
              <RatedMeter n={c.startedCount} />
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <EyeOff className="size-3.5" aria-hidden />
                Scores stay hidden until the end.
              </p>
            </>
          )}
          {(phase === 'pending' || phase === 'ended') && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {c.startedCount} started, {RATED_AT} needed
              </span>
              {phase === 'ended' ? (
                <RatedBadge rated={c.rated} />
              ) : (
                <span className="text-xs text-brand">{c.startedCount >= RATED_AT ? 'Will be rated' : 'Unrated'}</span>
              )}
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}

function ScheduleCard({ contest: c }: { contest: Details }) {
  const row = (k: string, value: ReactNode) => (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="text-right font-medium tabular-nums">{value}</dd>
    </div>
  )
  return (
    <Panel title="Schedule">
      <dl className="divide-y px-5 text-sm">
        {row('Starts', c.startAt ? `${shortDay(c.startAt)}, ${clock(c.startAt)}` : '–')}
        {row('Ends', c.endAt ? `${shortDay(c.endAt)}, ${clock(c.endAt)}` : '–')}
        {row('Length', length(c.durationMinutes))}
        {row('Questions', `${c.questionCount} · ${c.totalPoints} points`)}
        {row('Capacity', c.capacity ?? 'No limit')}
      </dl>
      <p className="border-t px-5 py-3 text-xs text-muted-foreground">Times are in your time zone ({zoneName()}).</p>
    </Panel>
  )
}

function ResultsTeaser({ contest: c, phase }: { contest: Details; phase: ContestPhase }) {
  if (phase === 'pending') {
    return (
      <Panel className="flex items-center gap-4 p-5">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-brand">
          <Loader2 className="size-5 animate-spin" aria-hidden />
        </span>
        <div>
          <h2 className="font-semibold">Scoring {c.startedCount} entries</h2>
          <p className="text-sm text-muted-foreground">
            Saved answers from people who didn&apos;t submit are being submitted for them. The leaderboard opens in about a minute.
          </p>
        </div>
      </Panel>
    )
  }
  return (
    <Panel
      title="Top of the leaderboard"
      extra={
        <Link to={`/contests/${c._id}/results`} className="ml-auto text-sm font-medium text-brand">
          Full results
        </Link>
      }
    >
      {c.top.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Nobody started this contest.</p>
      ) : (
        <ol className="divide-y">
          {c.top.map((r) => (
            <li key={`${r.rank}-${r.username}`} className="flex items-center gap-3 px-5 py-3">
              <span className={`w-5 font-heading font-semibold tabular-nums ${r.rank === 1 ? 'text-brand' : 'text-muted-foreground'}`}>
                {r.rank}
              </span>
              <UserAvatar name={r.username} size="sm" />
              <span className="flex-1 truncate font-medium">{r.username}</span>
              <span className="text-sm text-muted-foreground tabular-nums">{timeUsed(r.timeUsedMs)}</span>
              <span className="w-10 text-right font-heading font-semibold tabular-nums">{r.score}</span>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}
