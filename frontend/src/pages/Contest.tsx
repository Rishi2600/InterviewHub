import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Flag, LogIn, Play, Trophy, Users, Wifi, WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ContestStateBadge } from '@/components/ui/Badge'
import { Skeleton, SkeletonRows } from '@/components/ui/Skeleton'
import { EmptyState, ErrorState } from '@/components/ui/States'
import { Leaderboard } from '@/components/contest/Leaderboard'
import { ScorePanel } from '@/components/contest/ScorePanel'
import { useAuth } from '@/hooks/useAuth'
import { useLeaderboardSocket } from '@/hooks/useLeaderboardSocket'
import {
  activateContest,
  endContest,
  getContest,
  getContestResults,
  joinContest,
  scoreContestant,
} from '@/lib/endpoints'
import { errorMessage } from '@/lib/api'

export function Contest() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)

  const contestQuery = useQuery({
    queryKey: ['contest', id],
    queryFn: () => getContest(id!),
    enabled: Boolean(id),
  })

  // The entry roster doubles as our userId -> username map, because the live
  // leaderboard payload carries ids only.
  const entriesQuery = useQuery({
    queryKey: ['contest-entries', id],
    queryFn: () => getContestResults(id!),
    enabled: Boolean(id),
  })

  const contest = contestQuery.data
  const entries = useMemo(() => entriesQuery.data ?? [], [entriesQuery.data])

  const namesByUserId = useMemo(() => {
    const map: Record<string, string> = {}
    for (const entry of entries) map[entry.userId] = entry.username
    return map
  }, [entries])

  const isOwner = Boolean(contest && user && contest.ownerId === user.id)
  const canHost = isOwner || user?.role === 'admin'
  const hasJoined = entries.some((e) => e.userId === user?.id)
  // The server only lets hosts and entrants subscribe to the live board.
  const canWatch = canHost || hasJoined
  const board = useLeaderboardSocket(canWatch ? id : undefined)

  function refreshEntries() {
    void queryClient.invalidateQueries({ queryKey: ['contest-entries', id] })
  }

  const activateMutation = useMutation({
    mutationFn: () => activateContest(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['contest', id], updated)
      toast.success('Contest is live')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not activate the contest')),
  })

  const endMutation = useMutation({
    mutationFn: () => endContest(id!),
    onSuccess: (updated) => {
      queryClient.setQueryData(['contest', id], updated)
      // Final scores are written to Mongo on end — refetch to show them.
      refreshEntries()
      toast.success('Contest ended — final scores saved')
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not end the contest')),
  })

  const joinMutation = useMutation({
    mutationFn: () => joinContest(id!),
    onSuccess: () => {
      refreshEntries()
      toast.success("You're in — good luck")
    },
    onError: (err) => toast.error(errorMessage(err, 'Could not join the contest')),
  })

  const scoreMutation = useMutation({
    mutationFn: ({ userId, delta }: { userId: string; delta: number }) =>
      scoreContestant(id!, userId, delta),
    onMutate: ({ userId }) => setPendingUserId(userId),
    onSettled: () => setPendingUserId(null),
    // No manual board update needed — the server broadcasts the new standings.
    onError: (err) => toast.error(errorMessage(err, 'Could not apply the score')),
  })

  if (contestQuery.isLoading) return <ContestSkeleton />

  if (contestQuery.isError || !contest) {
    return (
      <ErrorState
        title="Couldn't load this contest"
        message={errorMessage(contestQuery.error, 'It may not exist, or you may not have access.')}
        onRetry={() => void contestQuery.refetch()}
      />
    )
  }

  const isEnded = contest.state === 'ended'
  const isActive = contest.state === 'active'

  return (
    <div className="animate-rise">
      <header className="flex flex-wrap items-start justify-between gap-6 pb-6">
        <div className="min-w-0">
          <p className="label mb-3">Contest</p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-heading text-ink">{contest.title}</h1>
            <ContestStateBadge state={contest.state} />
            {canWatch && <ConnectionPill status={board.status} />}
          </div>
          <p className="mt-2 text-caption text-ink-muted">
            {isEnded
              ? 'Final standings below.'
              : isActive
                ? 'Scores update live for everyone watching.'
                : 'In draft — activate it to start scoring.'}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!hasJoined && !isEnded && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => joinMutation.mutate()}
              isLoading={joinMutation.isPending}
              leadingIcon={<LogIn className="size-3" />}
            >
              Join contest
            </Button>
          )}

          {/* Activate is the single primary action, and only while drafting. */}
          {canHost && contest.state === 'draft' && (
            <Button
              size="sm"
              onClick={() => activateMutation.mutate()}
              isLoading={activateMutation.isPending}
              leadingIcon={<Play className="size-3" />}
            >
              Activate
            </Button>
          )}

          {canHost && isActive && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => endMutation.mutate()}
              isLoading={endMutation.isPending}
              leadingIcon={<Flag className="size-3" />}
            >
              End contest
            </Button>
          )}
        </div>
      </header>

      <div className="grid gap-8 border-t border-line pt-6 lg:grid-cols-[1fr_19rem]">
        {/* The board is the hero and the hot surface. */}
        <section>
          <div className="mb-4">
            <p className="label flex items-center gap-2">
              <Trophy className="size-3" aria-hidden />
              {isEnded ? 'Final standings' : 'Live leaderboard'}
            </p>
            {!isEnded && (
              <p className="mt-1.5 text-micro text-ink-faint">
                Top 10, updated the moment a score changes.
              </p>
            )}
          </div>

          {isEnded ? (
            <FinalStandings
              entries={[...entries].sort((a, b) => b.finalScore - a.finalScore)}
              currentUserId={user?.id ?? ''}
              isLoading={entriesQuery.isLoading}
            />
          ) : !canWatch ? (
            <EmptyState
              icon={<Trophy className="size-5" />}
              title="Join to see the live leaderboard"
              description="Standings are visible to the host and to participants."
            />
          ) : (
            <Leaderboard
              rows={board.rows}
              namesByUserId={namesByUserId}
              currentUserId={user?.id ?? ''}
              isLoading={!board.hasLoaded && board.status === 'connecting'}
            />
          )}
        </section>

        <div className="flex flex-col gap-8">
          {canHost && !isEnded && (
            <section>
              <p className="label mb-1.5">Award points</p>
              <p className="mb-4 text-micro text-ink-faint">Only you and admins see this.</p>
              {entriesQuery.isLoading ? (
                <SkeletonRows rows={3} />
              ) : (
                <ScorePanel
                  entries={entries}
                  pendingUserId={pendingUserId}
                  disabled={!isActive}
                  disabledReason={
                    !isActive ? 'Activate the contest before awarding points.' : undefined
                  }
                  onScore={(userId, delta) => scoreMutation.mutate({ userId, delta })}
                />
              )}
            </section>
          )}

          <section>
            <p className="label mb-4 flex items-center gap-2">
              <Users className="size-3" aria-hidden />
              Participants
              <span className="num text-ink-muted">{entries.length}</span>
            </p>
            {entriesQuery.isLoading ? (
              <SkeletonRows rows={3} />
            ) : entries.length === 0 ? (
              <EmptyState
                title="No participants yet"
                description="Anyone with the link can join while the contest is open."
              />
            ) : (
              <ul>
                {entries.map((entry) => (
                  <li
                    key={entry.userId}
                    className="flex items-center justify-between gap-2 border-t border-line px-1 py-2.5 first:border-t-0 hover:bg-surface"
                  >
                    <span className="truncate text-caption text-ink">
                      {entry.username}
                      {entry.userId === user?.id && (
                        <span className="ml-1 text-ink-faint">(you)</span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function FinalStandings({
  entries,
  currentUserId,
  isLoading,
}: {
  entries: Array<{ userId: string; username: string; finalScore: number; finalRank: number }>
  currentUserId: string
  isLoading: boolean
}) {
  if (isLoading) return <SkeletonRows rows={5} />

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={<Trophy className="size-5" />}
        title="No final scores"
        description="This contest ended without any scored participants."
      />
    )
  }

  return (
    <ol>
      {entries.map((entry, index) => (
        <li
          key={entry.userId}
          className={`flex items-center gap-3 border-t border-line px-2 py-2.5 first:border-t-0 ${
            entry.userId === currentUserId ? 'bg-sand-soft' : ''
          }`}
        >
          <span className="num w-5 text-center text-micro text-ink-faint">
            {entry.finalRank || index + 1}
          </span>
          <span className="min-w-0 flex-1 truncate text-caption text-ink">{entry.username}</span>
          <span className="num text-subheading text-ink">{entry.finalScore}</span>
        </li>
      ))}
    </ol>
  )
}

function ConnectionPill({ status }: { status: string }) {
  const connected = status === 'connected'
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 text-micro ${
        connected ? 'text-sage' : 'text-wheat'
      }`}
    >
      {connected ? <Wifi className="size-3" aria-hidden /> : <WifiOff className="size-3" aria-hidden />}
      {connected ? 'Live' : status === 'connecting' ? 'Connecting…' : 'Offline'}
    </span>
  )
}

function ContestSkeleton() {
  return (
    <div>
      <div className="pb-6">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-3 h-4 w-72" />
      </div>
      <div className="grid gap-8 border-t border-line pt-6 lg:grid-cols-[1fr_19rem]">
        <div>
          <Skeleton className="mb-4 h-5 w-40" />
          <SkeletonRows rows={5} />
        </div>
        <div>
          <Skeleton className="mb-4 h-5 w-32" />
          <SkeletonRows rows={3} />
        </div>
      </div>
    </div>
  )
}