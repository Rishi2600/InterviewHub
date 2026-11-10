import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useInfiniteQuery, useMutation } from '@tanstack/react-query'
import { ArrowRight, ChevronRight, Lock, Loader2, Plus, Search, Settings2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { LiveDot } from '@/components/common/LiveDot'
import { UserAvatar } from '@/components/common/UserAvatar'
import { ErrorState } from '@/components/common/States'
import { PageHeader } from '@/components/layout/PageHeader'
import { CodeBadge, HostingBadge, JoinedBadge, PhaseBadge, RATED_AT, RatedBadge, RatedMeter } from '@/components/contest/bits'
import { NewContestButton } from '@/components/contest/NewContestButton'
import { useAuth } from '@/hooks/useAuth'
import { useNow } from '@/hooks/useNow'
import { browseContests, joinContest } from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'
import { clock, countdown, dayLabel, length, longDay, shortDay, startsIn } from '@/lib/contest-time'
import type { BrowsePhase, ContestCard } from '@/types'

const PAST_PREVIEW = 5

/** Debounces the search box so typing does not fire a request per key. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), ms)
    return () => window.clearTimeout(id)
  }, [value, ms])
  return debounced
}

function useBrowse(phase: BrowsePhase, q: string, limit: number, enabled = true) {
  const { user } = useAuth()
  return useInfiniteQuery({
    queryKey: ['contests', 'browse', phase, q, limit, user?.id ?? null],
    queryFn: ({ pageParam }) => browseContests({ phase, q: q || undefined, cursor: pageParam, limit }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled,
  })
}

/** The public contests page (option A): live now, upcoming by day, past. */
export function ContestsBrowse() {
  const { isAuthenticated } = useAuth()
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim())
  const [showAllPast, setShowAllPast] = useState(false)
  const now = useNow(1000)

  const live = useBrowse('live', q, 24)
  const upcoming = useBrowse('upcoming', q, 20)
  const past = useBrowse('past', q, showAllPast ? 20 : PAST_PREVIEW)

  const liveItems = live.data?.pages.flatMap((p) => p.items) ?? []
  const upcomingItems = useMemo(() => upcoming.data?.pages.flatMap((p) => p.items) ?? [], [upcoming.data])
  const pastItems = past.data?.pages.flatMap((p) => p.items) ?? []
  const totals = {
    live: live.data?.pages[0]?.total ?? 0,
    upcoming: upcoming.data?.pages[0]?.total ?? 0,
    past: past.data?.pages[0]?.total ?? 0,
  }

  // Upcoming contests grouped by local day, in start order.
  const days = useMemo(() => {
    const groups: { key: string; items: ContestCard[] }[] = []
    for (const c of upcomingItems) {
      const key = c.startAt ? new Date(c.startAt).toDateString() : 'unscheduled'
      const last = groups[groups.length - 1]
      if (last?.key === key) last.items.push(c)
      else groups.push({ key, items: [c] })
    }
    return groups
  }, [upcomingItems])

  return (
    <>
      {isAuthenticated && (
        <PageHeader title={<span className="font-medium">Contests</span>}>
          <NewContestButton />
        </PageHeader>
      )}

      <div className={isAuthenticated ? 'grid gap-10' : 'grid gap-6'}>
        {!isAuthenticated && (
          <div className="grid gap-2">
            <h1 className="text-3xl font-semibold">Contests</h1>
            <p className="max-w-2xl text-muted-foreground">
              Timed quizzes, open to everyone. Contests with {RATED_AT} or more starters count toward each
              entrant&apos;s score. Sign in to see the details and join.
            </p>
          </div>
        )}

        <div className="grid gap-10">
          <label className="relative flex w-full items-center sm:w-72">
            <Search className="absolute left-2.5 size-4 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contests"
              aria-label="Search contests"
              maxLength={80}
              className="pl-8"
            />
          </label>

          <section className="grid gap-4">
            <div className="flex items-center gap-2">
              <LiveDot />
              <h2 className="text-xl font-semibold">Live now</h2>
              <span className="text-sm text-muted-foreground">{totals.live}</span>
            </div>
            {live.isPending ? (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-72 rounded-xl" />
                ))}
              </div>
            ) : live.isError ? (
              <ErrorState title="Could not load contests" message={errorMessage(live.error)} onRetry={() => void live.refetch()} />
            ) : liveItems.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {q ? 'No live contests match your search.' : 'Nothing is running right now.'}
              </p>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {liveItems.map((c) => (
                  <LiveCard key={c._id} contest={c} now={now} />
                ))}
              </div>
            )}
            <MoreButton query={live} />
          </section>

          <section className="grid gap-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-semibold">Upcoming</h2>
              <span className="text-sm text-muted-foreground">{totals.upcoming}</span>
            </div>
            {upcoming.isPending ? (
              <Skeleton className="h-40 rounded-xl" />
            ) : days.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {q ? 'No upcoming contests match your search.' : 'Nothing scheduled yet.'}
              </p>
            ) : (
              days.map((group) => (
                <div key={group.key} className="grid gap-2">
                  <div className="text-sm">
                    <span className="font-medium">{dayLabel(group.items[0].startAt!, now)}</span>
                    <span className="text-muted-foreground"> · {longDay(group.items[0].startAt!)}</span>
                  </div>
                  <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                    {group.items.map((c) => (
                      <UpcomingRow key={c._id} contest={c} now={now} />
                    ))}
                  </ul>
                </div>
              ))
            )}
            <MoreButton query={upcoming} />
          </section>

          <section className="grid gap-4">
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-semibold">Past</h2>
              <span className="text-sm text-muted-foreground">{totals.past}</span>
              {totals.past > PAST_PREVIEW && (
                <button
                  type="button"
                  className="ml-auto text-sm font-medium text-brand"
                  onClick={() => setShowAllPast((v) => !v)}
                >
                  {showAllPast ? 'Show latest' : 'Show all'}
                </button>
              )}
            </div>
            {past.isPending ? (
              <Skeleton className="h-48 rounded-xl" />
            ) : pastItems.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                {q ? 'No past contests match your search.' : 'No contests have finished yet.'}
              </p>
            ) : (
              <PastTable items={pastItems} />
            )}
            {showAllPast && <MoreButton query={past} />}
          </section>
        </div>
      </div>
    </>
  )
}

function MoreButton({ query }: { query: ReturnType<typeof useBrowse> }) {
  if (!query.hasNextPage) return null
  return (
    <div className="flex justify-center">
      <Button variant="outline" size="sm" onClick={() => void query.fetchNextPage()} disabled={query.isFetchingNextPage}>
        {query.isFetchingNextPage && <Loader2 className="animate-spin" aria-hidden />}
        Load more
      </Button>
    </div>
  )
}

function Mine({ contest }: { contest: ContestCard }) {
  if (!contest.viewer) return null
  return (
    <>
      {contest.viewer.joined && <JoinedBadge />}
      {contest.viewer.hosting && <HostingBadge />}
    </>
  )
}

/** Where a card's button goes, and what it says, for this viewer. */
function LiveAction({ contest }: { contest: ContestCard }) {
  const navigate = useNavigate()
  const join = useMutation({
    mutationFn: () => joinContest(contest._id),
    onSuccess: () => navigate(`/contests/${contest._id}/play`),
    onError: (err) => toast.error(errorMessage(err, 'Could not join')),
  })
  if (!contest.viewer) {
    return (
      <Button variant="outline" size="sm" className="w-full" asChild>
        <Link to="/login" state={{ from: `/contests/${contest._id}` }}>
          <Lock aria-hidden />
          Sign in to view
        </Link>
      </Button>
    )
  }
  if (contest.viewer.hosting) {
    return (
      <Button variant="outline" size="sm" className="w-full" asChild>
        <Link to={`/contests/${contest._id}`}>
          <Settings2 aria-hidden />
          Manage
        </Link>
      </Button>
    )
  }
  if (contest.viewer.joined) {
    return (
      <Button size="sm" className="w-full" asChild>
        <Link to={`/contests/${contest._id}/play`}>
          <ArrowRight aria-hidden />
          Continue
        </Link>
      </Button>
    )
  }
  return (
    <Button size="sm" className="w-full" onClick={() => join.mutate()} disabled={join.isPending}>
      {join.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Plus aria-hidden />}
      Join now
    </Button>
  )
}

function LiveCard({ contest: c, now }: { contest: ContestCard; now: number }) {
  const start = new Date(c.startAt!).getTime()
  const end = new Date(c.endAt!).getTime()
  const elapsed = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
  return (
    <article className="flex flex-col gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <PhaseBadge phase="live" />
          <Mine contest={c} />
        </div>
        <div className="text-right leading-none">
          <div className="text-xs text-muted-foreground">Ends in</div>
          <div className="mt-1 font-heading text-2xl font-semibold text-brand tabular-nums">{countdown(end - now)}</div>
        </div>
      </div>
      <div className="grid gap-1.5">
        <h3 className="text-lg leading-snug font-semibold">
          {c.viewer ? (
            <Link to={`/contests/${c._id}`} className="hover:underline">
              {c.title}
            </Link>
          ) : (
            c.title
          )}
        </h3>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <UserAvatar name={c.hostName} size="sm" className="size-5 text-[9px]" />
          {c.hostName}
        </p>
      </div>
      <div className="grid gap-1.5">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${elapsed}%` }} />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground tabular-nums">
          <span>{clock(c.startAt!)}</span>
          <span>{clock(c.endAt!)}</span>
        </div>
      </div>
      <dl className="grid grid-cols-3 divide-x rounded-lg border text-center">
        {[
          ['Questions', c.questionCount],
          ['Length', length(c.durationMinutes)],
          ['Entrants', c.entrantCount],
        ].map(([k, v]) => (
          <div key={k} className="py-2">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-heading font-semibold tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      {c.startedCount < RATED_AT && <RatedMeter n={c.startedCount} />}
      <div className="mt-auto">
        <LiveAction contest={c} />
      </div>
    </article>
  )
}

function UpcomingRow({ contest: c, now }: { contest: ContestCard; now: number }) {
  const to = c.viewer ? `/contests/${c._id}` : '/login'
  return (
    <li>
      <Link
        to={to}
        state={c.viewer ? undefined : { from: `/contests/${c._id}` }}
        className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-x-4 gap-y-1 px-4 py-3.5 hover:bg-muted/50 sm:grid-cols-[5.5rem_1fr_auto_auto]"
      >
        <div className="row-span-2 sm:row-span-1">
          <div className="font-heading text-lg leading-none font-semibold tabular-nums">{clock(c.startAt!)}</div>
          <div className="mt-1 text-xs text-brand">{startsIn(new Date(c.startAt!).getTime() - now)}</div>
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate font-medium">{c.title}</span>
            <Mine contest={c} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-sm text-muted-foreground">
            <UserAvatar name={c.hostName} size="sm" className="size-4 text-[8px]" />
            {c.hostName}
            <span>·</span>
            {length(c.durationMinutes)}
            <span>·</span>
            {c.questionCount} {c.format === 'code' ? 'problems' : 'questions'}
            {c.format === 'code' && <CodeBadge />}
          </div>
        </div>
        <div className="hidden text-right text-sm sm:block">
          <div className="font-medium tabular-nums">
            {c.entrantCount}
            {c.capacity && <span className="text-muted-foreground">/{c.capacity}</span>}
          </div>
          <div className="text-xs text-muted-foreground">entered</div>
        </div>
        <div className="col-start-3 row-span-2 sm:col-start-auto sm:row-span-1">
          {c.viewer ? (
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          ) : (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="size-3.5" aria-hidden />
              <span className="hidden sm:inline">Sign in</span>
            </span>
          )}
        </div>
      </Link>
    </li>
  )
}

function PastTable({ items }: { items: ContestCard[] }) {
  const navigate = useNavigate()
  const signedIn = Boolean(items[0]?.viewer)
  const open = (c: ContestCard) =>
    signedIn
      ? navigate(c.phase === 'ended' ? `/contests/${c._id}/results` : `/contests/${c._id}`)
      : navigate('/login', { state: { from: `/contests/${c._id}` } })
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2.5 font-medium">Contest</th>
            <th className="hidden px-4 py-2.5 font-medium md:table-cell">Host</th>
            <th className="hidden px-4 py-2.5 font-medium sm:table-cell">Ended</th>
            <th className="hidden px-4 py-2.5 text-right font-medium sm:table-cell">Entrants</th>
            <th className="px-4 py-2.5 font-medium">Score</th>
            {signedIn && <th className="px-4 py-2.5 text-right font-medium">Your rank</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((c) => (
            <tr key={c._id} className="cursor-pointer border-t hover:bg-muted/50" onClick={() => open(c)}>
              <td className="px-4 py-3">
                <div className="font-medium">{c.title}</div>
                <div className="text-xs text-muted-foreground sm:hidden">
                  {shortDay(c.endAt!)} · {c.entrantCount} entrants
                </div>
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                <span className="flex items-center gap-1.5">
                  <UserAvatar name={c.hostName} size="sm" className="size-5 text-[9px]" />
                  {c.hostName}
                </span>
              </td>
              <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">{shortDay(c.endAt!)}</td>
              <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">{c.entrantCount}</td>
              <td className="px-4 py-3">
                {c.phase === 'pending' ? <PhaseBadge phase="pending" /> : <RatedBadge rated={c.rated} />}
              </td>
              {signedIn && (
                <td className="px-4 py-3 text-right tabular-nums">
                  {c.viewer?.rank ? (
                    <>
                      <span className="font-heading font-semibold">#{c.viewer.rank}</span>
                      <span className="text-muted-foreground"> of {c.startedCount}</span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
